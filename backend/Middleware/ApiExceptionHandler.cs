using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Middleware;
public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
public class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, detail) = exception switch
        {
            ApiException e => (e.Status, e.Message),
            DbUpdateConcurrencyException => (409, "The record changed. Reload and retry."),
            DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } } => (409, "A record with these unique details already exists."),
            _ => (500, "An unexpected error occurred. Use the trace ID when reporting this error.")
        };
        if (status == 500) logger.LogError(exception, "Request failed: {TraceId}", context.TraceIdentifier);
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = status, Title = status == 500 ? "Server error" : "Request rejected", Detail = detail,
            Extensions = { ["traceId"] = context.TraceIdentifier }
        }, ct);
        return true;
    }
}
