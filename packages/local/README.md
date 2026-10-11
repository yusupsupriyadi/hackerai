# @hackerai/local

DiggerAI Local Sandbox Client - Execute commands on your local machine from DiggerAI.

## Quick Start

No installation or manual token handling is required:

1. Go to [DiggerAI Settings](https://hackerai.co/settings)
2. Open "Remote Control"
3. Click "Copy connect command"
4. Paste and run the command in your terminal

The copied command runs the latest package with your authentication token
included automatically.

## Global Installation (Optional)

```bash
npm install -g @hackerai/local
```

After installation, copy the connect command from DiggerAI Settings and replace
`npx @hackerai/local@latest` with `hackerai-local`. Leave the generated
arguments unchanged.

Commands run directly on your host OS. The client connects to DiggerAI and relays commands in real-time.

## Options

| Option             | Description                                                    |
| ------------------ | -------------------------------------------------------------- |
| `--token TOKEN`    | Authentication token included in the copied command (required) |
| `--name NAME`      | Optional connection name fallback (default: hostname)          |
| `--convex-url URL` | Override backend URL included for non-production environments  |
| `--help, -h`       | Show help message                                              |

## Security

Commands run directly on your OS without any isolation. Only connect machines you trust and control. The client auto-terminates after 1 hour of inactivity.

## License

MIT
