using PhoneBookAPI.Data.Enums;

namespace PhoneBookAPI.Models;

public class MessageResultModel
{
    public required int Id { get; init; }
    public required MessageType Type { get; init; }
    public required MessageStatus Status { get; init; }
    public required string Body { get; init; }
    public required DateTime Date { get; init; }
    public required int ContactId { get; init; }
    public required string ContactName { get; init; }
    public required string ContactPhoneNumber { get; init; }
    public required string ContactEmail { get; init; }
}
