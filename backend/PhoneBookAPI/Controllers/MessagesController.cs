using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhoneBookAPI.Data;
using PhoneBookAPI.Data.Entities;
using PhoneBookAPI.Data.Enums;
using PhoneBookAPI.Extensions;
using PhoneBookAPI.Models;

namespace PhoneBookAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/messages")]
public class MessagesController : ControllerBase
{
    private const int MaxPageSize = 100;
    private const string LikeEscape = "\\";

    private static readonly Expression<Func<Message, MessageResultModel>> ToResult = m => new MessageResultModel
    {
        Id = m.Id,
        Type = m.Type,
        Status = m.Status,
        Body = m.Body,
        Date = m.Date,
        ContactId = m.ContactId,
        ContactName = m.Contact.Name + " " + m.Contact.Surname,
        ContactPhoneNumber = m.Contact.PhoneNumber,
        ContactEmail = m.Contact.Email
    };

    private readonly PhoneBookDbContext _context;

    public MessagesController(PhoneBookDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<MessageResultModel>>> GetMessages([FromQuery] MessageQueryModel query)
    {
        var userId = User.GetUserId();
        var messages = Filter(_context.Messages.AsNoTracking().Where(m => m.UserId == userId), query);

        var total = await messages.CountAsync();
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);
        var lastPage = total == 0 ? 1 : (total - 1) / pageSize + 1;
        var page = Math.Clamp(query.Page, 1, lastPage);

        var items = await Sort(messages, query)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToResult)
            .ToListAsync();

        return new PagedResult<MessageResultModel>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MessageResultModel>> GetMessage(int id)
    {
        var message = await FindMessageAsync(User.GetUserId(), id);
        if (message is null)
        {
            return Problem(detail: "Message not found", statusCode: StatusCodes.Status404NotFound);
        }

        return message;
    }

    [HttpPost]
    [ProducesResponseType<MessageResultModel>(StatusCodes.Status201Created)]
    public async Task<ActionResult<MessageResultModel>> CreateMessage(NewMessageModel newMessageModel)
    {
        var userId = User.GetUserId();
        var contactExists = await _context.Contacts
            .AnyAsync(c => c.Id == newMessageModel.ContactId && c.UserId == userId);
        if (!contactExists)
        {
            return Problem(detail: "Contact not found", statusCode: StatusCodes.Status404NotFound);
        }

        var message = new Message
        {
            ContactId = newMessageModel.ContactId,
            Type = newMessageModel.Type!.Value,
            Body = newMessageModel.Body.Trim(),
            Status = MessageStatus.Queued,
            Date = DateTime.UtcNow,
            UserId = userId
        };

        _context.Add(message);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetMessage), new { id = message.Id }, await FindMessageAsync(userId, message.Id));
    }

    private Task<MessageResultModel?> FindMessageAsync(int userId, int id) =>
        _context.Messages
            .AsNoTracking()
            .Where(m => m.UserId == userId && m.Id == id)
            .Select(ToResult)
            .FirstOrDefaultAsync();

    private static IQueryable<Message> Filter(IQueryable<Message> messages, MessageQueryModel query)
    {
        if (query.Type is { } type)
        {
            messages = messages.Where(m => m.Type == type);
        }

        if (query.Status is { } status)
        {
            messages = messages.Where(m => m.Status == status);
        }

        if (query.ContactId is { } contactId)
        {
            messages = messages.Where(m => m.ContactId == contactId);
        }

        var search = query.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            var pattern = $"%{EscapeLikePattern(search)}%";
            messages = messages.Where(m =>
                EF.Functions.ILike(m.Body, pattern, LikeEscape) ||
                EF.Functions.ILike(m.Contact.Name, pattern, LikeEscape) ||
                EF.Functions.ILike(m.Contact.Surname, pattern, LikeEscape) ||
                EF.Functions.ILike(m.Contact.Name + " " + m.Contact.Surname, pattern, LikeEscape));
        }

        return messages;
    }

    private static IOrderedQueryable<Message> Sort(IQueryable<Message> messages, MessageQueryModel query)
    {
        var descending = query.SortDirection == SortDirection.Desc;

        var ordered = query.SortBy switch
        {
            MessageSortField.Contact => descending
                ? messages.OrderByDescending(m => m.Contact.Surname).ThenByDescending(m => m.Contact.Name)
                : messages.OrderBy(m => m.Contact.Surname).ThenBy(m => m.Contact.Name),
            MessageSortField.Type => descending
                ? messages.OrderByDescending(m => m.Type)
                : messages.OrderBy(m => m.Type),
            MessageSortField.Status => descending
                ? messages.OrderByDescending(m => m.Status)
                : messages.OrderBy(m => m.Status),
            _ => descending
                ? messages.OrderByDescending(m => m.Date)
                : messages.OrderBy(m => m.Date)
        };

        return descending ? ordered.ThenByDescending(m => m.Id) : ordered.ThenBy(m => m.Id);
    }

    private static string EscapeLikePattern(string value) => value
        .Replace(LikeEscape, LikeEscape + LikeEscape)
        .Replace("%", LikeEscape + "%")
        .Replace("_", LikeEscape + "_");
}
