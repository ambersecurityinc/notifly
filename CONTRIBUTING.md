# Contributing to notifly

Thank you for your interest in contributing to notifly!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/notifly.git
   cd notifly
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run tests:
   ```bash
   npm test
   ```

4. Run type checking:
   ```bash
   npm run typecheck
   ```

5. Build the library:
   ```bash
   npm run build
   ```

## Adding a New Service

1. Create a new file in `src/services/<name>.ts` implementing the `ServiceDefinition` interface.
2. Export a singleton instance of your service class.
3. Register the service in `src/services/index.ts`.
4. Add a corresponding test file at `src/services/<name>.test.ts`.
5. Update the README with the URL format for your new service.

## Code Style

- All code is TypeScript with strict mode enabled.
- Use `.js` extensions in all import paths (required for ESM/NodeNext module resolution).
- Run `npm run typecheck` before submitting a pull request.
- Write tests for any new functionality.

## Pull Requests

- Fork the repository and create a feature branch.
- Ensure all tests pass before submitting.
- Keep pull requests focused on a single change.
- Include a clear description of the changes.
