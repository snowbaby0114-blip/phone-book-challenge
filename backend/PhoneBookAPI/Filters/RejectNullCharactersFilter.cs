using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace PhoneBookAPI.Filters;

public class RejectNullCharactersFilter : IActionFilter
{
    private const char NullCharacter = '\0';

    public void OnActionExecuting(ActionExecutingContext context)
    {
        foreach (var (name, argument) in context.ActionArguments)
        {
            foreach (var path in FindPathsWithNullCharacters(name, argument))
            {
                context.ModelState.AddModelError(path, "The value contains an invalid character.");
            }
        }

        if (context.ModelState.IsValid)
        {
            return;
        }

        var problemDetailsFactory = context.HttpContext.RequestServices.GetRequiredService<ProblemDetailsFactory>();
        var problem = problemDetailsFactory.CreateValidationProblemDetails(context.HttpContext, context.ModelState);
        context.Result = new BadRequestObjectResult(problem);
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }

    private static IEnumerable<string> FindPathsWithNullCharacters(string name, object? argument)
    {
        if (argument is string text)
        {
            if (text.Contains(NullCharacter))
            {
                yield return name;
            }

            yield break;
        }

        if (argument is null || argument.GetType().IsPrimitive || argument.GetType().IsEnum)
        {
            yield break;
        }

        var stringProperties = argument.GetType()
            .GetProperties()
            .Where(property => property.PropertyType == typeof(string) && property.GetIndexParameters().Length == 0 && property.CanRead);

        foreach (var property in stringProperties)
        {
            if (property.GetValue(argument) is string value && value.Contains(NullCharacter))
            {
                yield return property.Name;
            }
        }
    }
}
