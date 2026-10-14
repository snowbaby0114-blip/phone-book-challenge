using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using PhoneBookAPI.Data.Entities;

namespace PhoneBookAPI.Services;

public enum PasswordCheck
{
    Invalid,
    Valid,
    ValidNeedsRehash
}

public class PasswordService
{
    private const byte IdentityV3Marker = 0x01;
    private const int IdentityV3Length = 61;

    private static readonly User HashOwner = new();

    private readonly PasswordHasher<User> _hasher = new();
    private readonly string _decoyHash;

    public PasswordService()
    {
        _decoyHash = Hash(Convert.ToHexString(RandomNumberGenerator.GetBytes(16)));
    }

    public string Hash(string password) => _hasher.HashPassword(HashOwner, password);

    public PasswordCheck Check(string storedPassword, string providedPassword)
    {
        if (!IsHash(storedPassword))
        {
            return FixedTimeEquals(storedPassword, providedPassword)
                ? PasswordCheck.ValidNeedsRehash
                : PasswordCheck.Invalid;
        }

        return _hasher.VerifyHashedPassword(HashOwner, storedPassword, providedPassword) switch
        {
            PasswordVerificationResult.Success => PasswordCheck.Valid,
            PasswordVerificationResult.SuccessRehashNeeded => PasswordCheck.ValidNeedsRehash,
            _ => PasswordCheck.Invalid
        };
    }

    public void VerifyAgainstDecoy(string providedPassword) =>
        _hasher.VerifyHashedPassword(HashOwner, _decoyHash, providedPassword);

    private static bool IsHash(string value)
    {
        Span<byte> decoded = stackalloc byte[IdentityV3Length];
        return Convert.TryFromBase64String(value, decoded, out var written)
            && written == IdentityV3Length
            && decoded[0] == IdentityV3Marker;
    }

    private static bool FixedTimeEquals(string left, string right) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));
}
