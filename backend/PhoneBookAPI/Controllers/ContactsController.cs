using System.Linq.Expressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhoneBookAPI.Data;
using PhoneBookAPI.Data.Entities;
using PhoneBookAPI.Extensions;
using PhoneBookAPI.Models;

namespace PhoneBookAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/contacts")]
public class ContactsController : ControllerBase
{
    private static readonly Expression<Func<Contact, ContactResultModel>> ToResult = c => new ContactResultModel
    {
        Id = c.Id,
        Name = c.Name,
        Surname = c.Surname,
        PhoneNumber = c.PhoneNumber,
        Email = c.Email,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };

    private readonly PhoneBookDbContext _context;

    public ContactsController(PhoneBookDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetContacts()
    {
        var userId = User.GetUserId();
        var contacts = await _context.Contacts
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Surname)
            .ThenBy(c => c.Id)
            .Select(ToResult)
            .ToListAsync();

        return Ok(contacts);
    }

    [HttpPost]
    public async Task<IActionResult> CreateContact(NewContactModel newContactModel)
    {
        var now = DateTime.UtcNow;
        var newContact = new Contact
        {
            Name = newContactModel.Name,
            Surname = newContactModel.Surname,
            PhoneNumber = newContactModel.PhoneNumber,
            Email = newContactModel.Email,
            CreatedAt = now,
            UpdatedAt = now,
            UserId = User.GetUserId()
        };

        _context.Add(newContact);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Contact successfully created" });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetContact(int id)
    {
        var userId = User.GetUserId();
        var contact = await _context.Contacts
            .AsNoTracking()
            .Where(c => c.UserId == userId && c.Id == id)
            .Select(ToResult)
            .FirstOrDefaultAsync();

        return contact is null
            ? Problem(detail: "Contact not found", statusCode: StatusCodes.Status404NotFound)
            : Ok(contact);
    }
}
