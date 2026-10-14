using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhoneBookAPI.Data;
using PhoneBookAPI.Data.Entities;
using PhoneBookAPI.Extensions;
using PhoneBookAPI.Models;
using PhoneBookAPI.Services;

namespace PhoneBookAPI.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly PhoneBookDbContext _context;
    private readonly PasswordService _passwords;

    public AuthController(PhoneBookDbContext context, PasswordService passwords)
    {
        _context = context;
        _passwords = passwords;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginModel loginModel)
    {
        var email = loginModel.Email.NormalizeEmail();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

        if (user is null)
        {
            _passwords.VerifyAgainstDecoy(loginModel.Password);
            return InvalidCredentials();
        }

        var check = _passwords.Check(user.Password, loginModel.Password);
        if (check == PasswordCheck.Invalid)
        {
            return InvalidCredentials();
        }

        if (check == PasswordCheck.ValidNeedsRehash)
        {
            user.Password = _passwords.Hash(loginModel.Password);
            await _context.SaveChangesAsync();
        }

        await HttpContext.SignInUserAsync(user);

        return Ok(new { user = new { user.Name, user.Surname, user.Email }, message = "Successfully logged in" });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(SignUpModel signUpModel)
    {
        var email = signUpModel.Email.NormalizeEmail();
        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
        {
            return Problem(detail: "An account with this email already exists", statusCode: StatusCodes.Status409Conflict);
        }

        var now = DateTime.UtcNow;
        var newUser = new User
        {
            Email = email,
            Name = signUpModel.Name,
            Surname = signUpModel.Surname,
            Password = _passwords.Hash(signUpModel.Password),
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Add(newUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "User successfully registered" });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { message = "Successfully logged out" });
    }

    private ObjectResult InvalidCredentials() =>
        Problem(detail: "Invalid email or password", statusCode: StatusCodes.Status401Unauthorized);
}
