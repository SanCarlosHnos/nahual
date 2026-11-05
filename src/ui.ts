import { styleText } from 'node:util';

type Style = Parameters<typeof styleText>[0];
const paint = (style: Style, text: string): string => styleText(style, text);

let streaming = false;

export const ui = {
  paint,
  banner(model: string, workdir: string): void {
    console.log(paint(['bold', 'yellow'], '\n⚒  FORJA') + paint('gray', ' — IA local que construye software y se mejora a sí misma'));
    console.log(paint('gray', `   modelo: ${model}`));
    console.log(paint('gray', `   carpeta de trabajo: ${workdir}`));
    console.log(paint('gray', '   escribe /ayuda para ver los comandos\n'));
  },
  info(msg: string): void {
    console.log(paint('cyan', msg));
  },
  ok(msg: string): void {
    console.log(paint('green', '✔ ' + msg));
  },
  warn(msg: string): void {
    console.log(paint('yellow', '⚠ ' + msg));
  },
  error(msg: string): void {
    console.log(paint('red', '✖ ' + msg));
  },
  step(n: number, max: number): void {
    console.log(paint('magenta', `\n── paso ${n}/${max} ──`));
  },
  stream(token: string): void {
    streaming = true;
    process.stdout.write(paint('gray', token));
  },
  endStream(): void {
    if (streaming) process.stdout.write('\n');
    streaming = false;
  },
  action(desc: string): void {
    console.log(paint(['bold', 'blue'], '→ ' + desc));
  },
  result(ok: boolean, output: string): void {
    const lines = output.split('\n');
    const preview = lines.slice(0, 6).join('\n') + (lines.length > 6 ? `\n… (${lines.length - 6} líneas más)` : '');
    console.log(paint(ok ? 'gray' : 'red', indent(preview)));
  },
  answer(text: string): void {
    console.log('\n' + paint('white', text) + '\n');
  },
};

function indent(s: string): string {
  return s
    .split('\n')
    .map((l) => '   ' + l)
    .join('\n');
}
