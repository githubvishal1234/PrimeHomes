# Build context: PrimeHomes.API/
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY PrimeHomes.API/PrimeHomes.API.csproj PrimeHomes.API/
RUN dotnet restore PrimeHomes.API/PrimeHomes.API.csproj
COPY PrimeHomes.API/ PrimeHomes.API/
RUN dotnet publish PrimeHomes.API/PrimeHomes.API.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
# Uploaded photos live on a volume so they survive container rebuilds.
RUN mkdir -p /app/wwwroot/uploads && chown -R app:app /app/wwwroot
USER app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
# Probes: GET /health/live (process up) and /health/ready (database reachable), e.g. from a load balancer.
ENTRYPOINT ["dotnet", "PrimeHomes.API.dll"]
