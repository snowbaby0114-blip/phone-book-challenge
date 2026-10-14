using PhoneBookAPI.Data.Enums;

namespace PhoneBookAPI.Models;

public class MessageQueryModel
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public MessageSortField SortBy { get; set; } = MessageSortField.Date;
    public SortDirection SortDirection { get; set; } = SortDirection.Desc;
    public MessageType? Type { get; set; }
    public MessageStatus? Status { get; set; }
    public int? ContactId { get; set; }
    public string? Search { get; set; }
}
