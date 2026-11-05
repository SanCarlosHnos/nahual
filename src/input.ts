import * as readline from 'node:readline';

/**
 * Lector de líneas con cola: no pierde lo que el usuario escribe (o lo que llega por
 * una tubería) mientras Forja está ocupada. `ask` devuelve null cuando la entrada se cierra.
 */
export class LineInput {
  private readonly rl: readline.Interface;
  private readonly queue: string[] = [];
  private waiting: ((line: string | null) => void) | null = null;
  private closed = false;

  constructor(onInterrupt: () => void) {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    this.rl.on('line', (line) => {
      if (this.waiting) {
        const resolve = this.waiting;
        this.waiting = null;
        resolve(line);
      } else this.queue.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      this.waiting?.(null);
      this.waiting = null;
    });
    this.rl.on('SIGINT', onInterrupt);
  }

  ask(prompt: string): Promise<string | null> {
    const queued = this.queue.shift();
    if (queued !== undefined) {
      process.stdout.write(prompt + queued + '\n');
      return Promise.resolve(queued);
    }
    if (this.closed) return Promise.resolve(null);
    this.rl.setPrompt(prompt);
    this.rl.prompt();
    return new Promise((resolve) => (this.waiting = resolve));
  }

  close(): void {
    this.rl.close();
  }
}
