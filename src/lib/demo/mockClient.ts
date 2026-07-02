// Faux client Supabase utilisé uniquement quand NEXT_PUBLIC_DEMO_MODE=true.
// Reproduit l'API chainable de supabase-js (.from().eq().select()... ) mais
// lit/écrit dans une base en mémoire (voir seed.ts). Aucun réseau, aucune
// vraie base de données n'est jamais contactée en mode démo.

import { createDemoDb, demoProfiles, genId } from "./seed";

type Row = Record<string, unknown>;

const db = createDemoDb();

// Table de correspondance pour les jointures embarquées façon Postgrest
// (ex: .select("*, note_reactions(...)") -> note_reactions.note_id === notes_internes.id)
const EMBED_FK: Record<string, string> = {
  note_reactions: "note_id",
  event_checklist: "event_id",
  event_photos: "event_id",
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 12}`;
}
function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

function parseOrClause(col: string, op: string, val: string) {
  const v: unknown = val === "null" ? null : val;
  return (row: Row) => {
    if (op === "eq") return String(row[col]) === String(v);
    if (op === "neq") return String(row[col]) !== String(v);
    return false;
  };
}

class QueryBuilder {
  private table: string;
  private filters: ((row: Row) => boolean)[] = [];
  private orders: { col: string; ascending: boolean }[] = [];
  private _limit: number | null = null;
  private _single = false;
  private _maybe = false;
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private selectOpts: { count?: string; head?: boolean } | null = null;
  private embeds: string[] = [];

  constructor(table: string) {
    this.table = table;
  }

  private rows(): Row[] {
    return (db as unknown as Record<string, Row[]>)[this.table] ?? ((db as unknown as Record<string, Row[]>)[this.table] = []);
  }

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts) this.selectOpts = opts;
    if (cols) {
      const matches = cols.matchAll(/(\w+)\(/g);
      for (const m of matches) this.embeds.push(m[1]);
    }
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[]) {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => (r[col] as string) >= (val as string));
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => (r[col] as string) <= (val as string));
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }
  or(clauseStr: string) {
    const clauses = clauseStr.split(",").map((c) => {
      const [col, op, ...rest] = c.split(".");
      return parseOrClause(col, op, rest.join("."));
    });
    this.filters.push((r) => clauses.some((fn) => fn(r)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }
  single() {
    this._single = true;
    return this;
  }
  maybeSingle() {
    this._single = true;
    this._maybe = true;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  private async exec(): Promise<{ data: unknown; error: null; count?: number }> {
    const table = this.rows();

    if (this.op === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const inserted = items.map((item) => ({
        id: (item.id as string) ?? genId(this.table),
        created_at: new Date().toISOString(),
        ...item,
      }));
      table.push(...inserted);
      return { data: this._single ? inserted[0] ?? null : inserted, error: null };
    }

    if (this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      items.forEach((item) => {
        const idx = table.findIndex((r) => r.id === item.id);
        if (idx >= 0) Object.assign(table[idx], item);
        else table.push({ id: (item.id as string) ?? genId(this.table), created_at: new Date().toISOString(), ...item });
      });
      return { data: null, error: null };
    }

    if (this.op === "update") {
      const matched = table.filter((r) => this.filters.every((f) => f(r)));
      matched.forEach((r) => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
      return { data: this._single ? matched[0] ?? null : matched, error: null };
    }

    if (this.op === "delete") {
      const removed: Row[] = [];
      const kept: Row[] = [];
      table.forEach((r) => (this.filters.every((f) => f(r)) ? removed.push(r) : kept.push(r)));
      table.length = 0;
      table.push(...kept);
      return { data: removed, error: null };
    }

    // select
    let rows = table.filter((r) => this.filters.every((f) => f(r)));
    for (let i = this.orders.length - 1; i >= 0; i -= 1) {
      const { col, ascending } = this.orders[i];
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
      });
    }
    if (this._limit != null) rows = rows.slice(0, this._limit);

    if (this.embeds.length) {
      const allTables = db as unknown as Record<string, Row[]>;
      rows = rows.map((row) => {
        const embedded: Row = { ...row };
        for (const relTable of this.embeds) {
          const fk = EMBED_FK[relTable];
          if (!fk) continue;
          embedded[relTable] = (allTables[relTable] ?? []).filter((r) => r[fk] === row.id);
        }
        return embedded;
      });
    }

    if (this.selectOpts?.head) {
      return { data: null, error: null, count: rows.length };
    }
    if (this._single) {
      return { data: rows[0] ?? null, error: rows[0] || this._maybe ? null : null };
    }
    return { data: rows, error: null, count: rows.length };
  }
}

function makeChannel() {
  const chain = {
    on() {
      return chain;
    },
    subscribe(cb?: (status: string) => void) {
      cb?.("SUBSCRIBED");
      return { unsubscribe() {} };
    },
  };
  return chain;
}

function makeStorage() {
  return {
    from(_bucket: string) {
      return {
        async upload(path: string) {
          return { data: { path }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://picsum.photos/seed/${encodeURIComponent(path)}/900/600` } };
        },
        async remove() {
          return { data: null, error: null };
        },
      };
    },
  };
}

function currentDemoUser() {
  const uid = getCookie("demo_uid");
  if (!uid) return null;
  const profile = demoProfiles.find((p) => p.id === uid) ?? demoProfiles[0];
  return { id: profile.id, email: profile.email };
}

export function createDemoClient() {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
    auth: {
      async getUser() {
        return { data: { user: currentDemoUser() }, error: null };
      },
      async getSession() {
        const user = currentDemoUser();
        return { data: { session: user ? { user } : null }, error: null };
      },
      async signInWithPassword({ email }: { email: string; password: string }) {
        const profile =
          demoProfiles.find((p) => p.email.toLowerCase() === String(email).toLowerCase()) ?? demoProfiles[0];
        setCookie("demo_uid", profile.id);
        return { data: { user: { id: profile.id, email: profile.email } }, error: null };
      },
      async signOut() {
        deleteCookie("demo_uid");
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    channel: makeChannel,
    removeChannel() {},
    storage: makeStorage(),
  };
}
