using PhoneBookAPI.Data.Enums;

namespace PhoneBookAPI.Data.Entities;

public class Message
{
    public int Id { get; set; }
    public MessageType Type { get; set; }
    public string Body { get; set; }
    public int ContactId { get; set; }
    public virtual Contact Contact { get; set; }
    public int UserId { get; set; }
    public virtual User User { get; set; }
    public DateTime Date { get; set; }
    public MessageStatus Status { get; set; }
}