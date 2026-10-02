/**
 * The expression language of style recipes: sizes, constraints and closed sizes written as data
 * (`"width + a.panel"`, `"tuckDepth < depth - 5"`) so a recipe stays JSON that packio-api, a
 * solver and a reviewer can all read. Hand-written parser, no `eval` / `Function` (CSP-safe).
 *
 *   expr     := cond
 *   cond     := nullish ("?" expr ":" expr)?
 *   nullish  := or ("??" or)*
 *   or       := and (("or" | "||") and)*
 *   and      := not (("and" | "&&") not)*
 *   not      := ("not" | "!") not | compare
 *   compare  := sum (("<" | "<=" | ">" | ">=" | "==" | "!=") sum)?
 *   sum      := product (("+" | "-") product)*
 *   product  := unary (("*" | "/") unary)*
 *   unary    := "-" unary | primary
 *   primary  := number | 'string' | name | name "(" args ")" | "(" expr ")"
 *   name     := letter (letter | digit | "_" | ".")*
 *
 * Values are numbers, strings, booleans or `undefined` (a parameter that was not given).
 * Comparisons and logic are three-valued: a comparison with a missing or non-finite operand is
 * *unknown* (`null`), `and` / `or` / `not` follow Kleene logic, and a constraint fails only when
 * it is definitely `false` — the same as the hand-written checks, where `NaN > x` raised nothing.
 * `a ?? b` is `b` when `a` is missing or not a finite number.
 */

export type ExprValue = number | string | boolean | null | undefined;

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "name"; v: string }
  | { t: "call"; f: string; args: Node[] }
  | { t: "neg"; a: Node }
  | { t: "not"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "cond"; c: Node; a: Node; b: Node };

export class ExprError extends Error {
  constructor(
    message: string,
    readonly source: string,
  ) {
    super(`${message} in "${source}"`);
    this.name = "ExprError";
  }
}

const OPS = ["<=", ">=", "==", "!=", "&&", "||", "??", "<", ">", "+", "-", "*", "/", "(", ")", ",", "?", ":", "!"];

type Token = { k: "num"; v: number } | { k: "str"; v: string } | { k: "name"; v: string } | { k: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))!;
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) throw new ExprError("unterminated string", src);
      out.push({ k: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))!;
      out.push({ k: "name", v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`unexpected "${c}"`, src);
    out.push({ k: "op", v: op });
    i += op.length;
  }
  return out;
}

function parse(src: string): Node {
  const tokens = tokenize(src);
  let at = 0;
  const peek = () => tokens[at];
  const isOp = (v: string) => peek()?.k === "op" && peek()!.v === v;
  const isWord = (v: string) => peek()?.k === "name" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprError(`expected "${v}"`, src);
    at++;
  };

  const expr = (): Node => cond();
  const cond = (): Node => {
    const c = nullish();
    if (!isOp("?")) return c;
    at++;
    const a = expr();
    expect(":");
    return { t: "cond", c, a, b: expr() };
  };
  const nullish = (): Node => {
    let a = or();
    while (isOp("??")) {
      at++;
      a = { t: "bin", op: "??", a, b: or() };
    }
    return a;
  };
  const or = (): Node => {
    let a = and();
    while (isOp("||") || isWord("or")) {
      at++;
      a = { t: "bin", op: "or", a, b: and() };
    }
    return a;
  };
  const and = (): Node => {
    let a = not();
    while (isOp("&&") || isWord("and")) {
      at++;
      a = { t: "bin", op: "and", a, b: not() };
    }
    return a;
  };
  const not = (): Node => {
    if (isOp("!") || isWord("not")) {
      at++;
      return { t: "not", a: not() };
    }
    return compare();
  };
  const compare = (): Node => {
    const a = sum();
    const tok = peek();
    if (tok?.k === "op" && ["<", "<=", ">", ">=", "==", "!="].includes(tok.v)) {
      at++;
      return { t: "bin", op: tok.v, a, b: sum() };
    }
    return a;
  };
  const sum = (): Node => {
    let a = product();
    while (isOp("+") || isOp("-")) {
      const op = tokens[at++].v as string;
      a = { t: "bin", op, a, b: product() };
    }
    return a;
  };
  const product = (): Node => {
    let a = unary();
    while (isOp("*") || isOp("/")) {
      const op = tokens[at++].v as string;
      a = { t: "bin", op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (isOp("-")) {
      at++;
      return { t: "neg", a: unary() };
    }
    return primary();
  };
  const primary = (): Node => {
    const tok = peek();
    if (!tok) throw new ExprError("unexpected end", src);
    at++;
    if (tok.k === "num") return { t: "num", v: tok.v };
    if (tok.k === "str") return { t: "str", v: tok.v };
    if (tok.k === "name") {
      if (tok.v === "true" || tok.v === "false") return { t: "name", v: tok.v };
      // Keywords are operators, never names: `x + not y` is an error, not a call to `not`.
      if (tok.v === "not" || tok.v === "and" || tok.v === "or") throw new ExprError(`unexpected "${tok.v}"`, src);
      if (isOp("(")) {
        at++;
        const args: Node[] = [];
        if (!isOp(")")) {
          args.push(expr());
          while (isOp(",")) {
            at++;
            args.push(expr());
          }
        }
        expect(")");
        return { t: "call", f: tok.v, args };
      }
      return { t: "name", v: tok.v };
    }
    if (tok.v === "(") {
      const inner = expr();
      expect(")");
      return inner;
    }
    throw new ExprError(`unexpected "${tok.v}"`, src);
  };

  const node = expr();
  if (at !== tokens.length) throw new ExprError(`unexpected "${String(tokens[at].v)}"`, src);
  return node;
}

const cache = new Map<string, Node>();

/** Parses once per distinct source; throws `ExprError` on a syntax error. */
export function compile(src: string): Node {
  let node = cache.get(src);
  if (!node) {
    node = parse(src);
    cache.set(src, node);
  }
  return node;
}

function walk(n: Node, visit: (n: Node) => void): void {
  visit(n);
  if (n.t === "call") n.args.forEach((a) => walk(a, visit));
  else if (n.t === "neg" || n.t === "not") walk(n.a, visit);
  else if (n.t === "bin") [n.a, n.b].forEach((x) => walk(x, visit));
  else if (n.t === "cond") [n.c, n.a, n.b].forEach((x) => walk(x, visit));
}

/** The names an expression reads (parameters, dims, `t`, `a.panel`…), for recipe checks and the solver. */
export function namesOf(src: string): string[] {
  const out = new Set<string>();
  walk(compile(src), (n) => {
    if (n.t === "name" && n.v !== "true" && n.v !== "false") out.add(n.v);
  });
  return [...out];
}

/** The functions an expression calls. */
export function callsOf(src: string): string[] {
  const out = new Set<string>();
  walk(compile(src), (n) => {
    if (n.t === "call") out.add(n.f);
  });
  return [...out];
}

/** The functions an expression may call; a recipe naming any other fails to parse (`parseRecipe`). */
export type ExprFunction = (...args: ExprValue[]) => ExprValue;

export interface Scope {
  /** A name's value; `undefined` when it is not set. */
  get(name: string): ExprValue;
  fn?: Record<string, ExprFunction>;
}

const finite = (x: ExprValue): x is number => typeof x === "number" && Number.isFinite(x);
const missing = (x: ExprValue) => x === undefined || x === null || (typeof x === "number" && !Number.isFinite(x));

const arith = (x: ExprValue, y: ExprValue, f: (a: number, b: number) => number): ExprValue =>
  typeof x === "number" && typeof y === "number" ? f(x, y) : undefined;

/** Evaluates a compiled expression; unknown names are `undefined`, unknown functions throw. */
export function evaluate(node: Node, scope: Scope): ExprValue {
  switch (node.t) {
    case "num":
    case "str":
      return node.v;
    case "name":
      return node.v === "true" ? true : node.v === "false" ? false : scope.get(node.v);
    case "neg": {
      const a = evaluate(node.a, scope);
      return typeof a === "number" ? -a : undefined;
    }
    case "not": {
      const a = evaluate(node.a, scope);
      return a === null || a === undefined ? null : !a;
    }
    case "cond": {
      const c = evaluate(node.c, scope);
      if (c === null || c === undefined) return undefined;
      return c ? evaluate(node.a, scope) : evaluate(node.b, scope);
    }
    case "call": {
      const f = scope.fn?.[node.f];
      if (!f) throw new ExprError(`unknown function "${node.f}"`, node.f);
      return f(...node.args.map((a) => evaluate(a, scope)));
    }
    case "bin": {
      const { op } = node;
      if (op === "??") {
        const a = evaluate(node.a, scope);
        return missing(a) ? evaluate(node.b, scope) : a;
      }
      if (op === "and" || op === "or") {
        const a = evaluate(node.a, scope);
        const known = (x: ExprValue) => (x === null || x === undefined ? null : Boolean(x));
        const p = known(a);
        if (op === "and" && p === false) return false;
        if (op === "or" && p === true) return true;
        const q = known(evaluate(node.b, scope));
        if (op === "and") return q === false ? false : p === null || q === null ? null : true;
        return q === true ? true : p === null || q === null ? null : false;
      }
      const a = evaluate(node.a, scope);
      const b = evaluate(node.b, scope);
      switch (op) {
        case "+":
          return arith(a, b, (x, y) => x + y);
        case "-":
          return arith(a, b, (x, y) => x - y);
        case "*":
          return arith(a, b, (x, y) => x * y);
        case "/":
          return arith(a, b, (x, y) => x / y);
        case "==":
        case "!=": {
          if (a === undefined || a === null || b === undefined || b === null) return null;
          if (typeof a === "number" && !Number.isFinite(a)) return null;
          if (typeof b === "number" && !Number.isFinite(b)) return null;
          return op === "==" ? a === b : a !== b;
        }
        default: {
          if (!finite(a) || !finite(b)) return null;
          if (op === "<") return a < b;
          if (op === "<=") return a <= b;
          if (op === ">") return a > b;
          return a >= b;
        }
      }
    }
  }
}

/** A number, or `NaN` when the expression does not give one — sizes must always be numbers. */
export function evalNumber(src: string, scope: Scope): number {
  const v = evaluate(compile(src), scope);
  return typeof v === "number" ? v : NaN;
}
