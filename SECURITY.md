# Security Policy

## Known Vulnerabilities

### esbuild and vite
- **Severity**: 1 moderate, 1 high
- **Description**: esbuild enables any website to send requests to the development server and read responses
- **Status**: Will not fix (requires breaking changes)
- **Mitigation**: Only run the development server in trusted environments
- **Details**: This vulnerability only affects the development server, not production builds

## Reporting Security Issues

If you discover a security vulnerability, please create an issue in this repository.

## Security Best Practices

1. Always use the latest stable versions of dependencies
2. Run `npm audit` regularly
3. Only run the development server in trusted environments