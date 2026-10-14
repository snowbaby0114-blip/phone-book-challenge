using System.Security.Claims;

namespace PhoneBookAPI.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("The authenticated principal has no user id claim.");

        return int.Parse(claim.Value);
    }
}
