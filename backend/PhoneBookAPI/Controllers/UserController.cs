using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhoneBookAPI.Data;
using PhoneBookAPI.Extensions;
using PhoneBookAPI.Models;
using PhoneBookAPI.Services;

namespace PhoneBookAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    private readonly PhoneBookDbContext _context;
    private readonly PasswordService _passwords;

    public UserController(PhoneBookDbContext context, PasswordService passwords)
    {
        _context = context;
        _passwords = passwords;
    }

    [HttpGet("me")]
    public async Task<IActionResult> Get()
    {
        var userId = User.GetUserId();
        var profile = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.Name, u.Surname, u.Email })
            .FirstOrDefaultAsync();

        return profile is null ? UnknownUser() : Ok(profile);
    }

    [HttpPost("me/profile")]
    public async Task<IActionResult> UpdateMyProfile(UpdateProfileModel updateProfileModel)
    {
        var userId = User.GetUserId();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null)
        {
            return UnknownUser();
        }

        var email = updateProfileModel.Email.NormalizeEmail();
        if (await _context.Users.AnyAsync(u => u.Id != userId && u.Email.ToLower() == email))
        {
            return Problem(detail: "Email already in use", statusCode: StatusCodes.Status409Conflict);
        }

        user.Name = updateProfileModel.Name;
        user.Surname = updateProfileModel.Surname;
        user.Email = email;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await HttpContext.SignInUserAsync(user);

        return Ok(new { user.Name, user.Surname, user.Email });
    }

    [HttpPost("me/password")]
    public async Task<IActionResult> UpdateMyPassword(UpdatePasswordModel updatePasswordModel)
    {
        var userId = User.GetUserId();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null)
        {
            return UnknownUser();
        }

        if (_passwords.Check(user.Password, updatePasswordModel.CurrentPassword) == PasswordCheck.Invalid)
        {
            return Problem(detail: "Current password is incorrect", statusCode: StatusCodes.Status400BadRequest);
        }

        user.Password = _passwords.Hash(updatePasswordModel.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private ObjectResult UnknownUser() =>
        Problem(detail: "The signed-in user no longer exists", statusCode: StatusCodes.Status401Unauthorized);
}
