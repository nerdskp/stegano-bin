# Contributing to SteganoBin

First off, thank you for considering contributing to SteganoBin! It's people like you that make open-source tools better for everyone.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/stegano-bin.git
   cd stegano-bin
   ```
3. **Install dependencies** using `pnpm` (required):
   ```bash
   pnpm install
   ```
4. **Create a new branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```

## Development Workflow

- Run the local development server:
  ```bash
  pnpm dev
  ```
- Make your changes in the codebase.
- Ensure your code follows the existing style and runs without errors. You can verify this by running:
  ```bash
  pnpm run build
  ```

## Submitting a Pull Request

1. **Commit your changes**. Use descriptive commit messages:
   ```bash
   git commit -m "feat: add support for webp images"
   ```
2. **Push your branch** to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
3. **Open a Pull Request** against the `main` branch of the original repository.
4. Fill out the Pull Request template with details about your changes.

## Bug Reports and Feature Requests

If you find a bug or have an idea for a feature, please use the issue templates provided in the repository to submit them. Provide as much detail as possible to help us understand and resolve the issue.

Thank you for contributing!
