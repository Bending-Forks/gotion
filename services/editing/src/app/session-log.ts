import type { Id, Operation, PageId, Seq } from '../domain/document.ts';

/**
 * The session log of the pages: for each page, the operations Editing accepted, in order,
 * each at its `seq`, from 1. It is the Event Sourcing of Editing.
 */
export interface SessionLog {
  /** The last `seq` of the log of `page`, 0 if it holds no operation. */
  lastSeq(page: PageId): Promise<Seq>;
  /**
   * Appends `operation` to the log of `page` at `seq`, and resolves only once the append is
   * committed. Rejects with {@link LogExtendedError} if the log already has `seq`.
   */
  append(page: PageId, seq: Seq, operation: Operation): Promise<void>;
}

/**
 * The log of a page already has the `seq` of an append: another instance of Editing extended it,
 * so this one holds a stale page and may acknowledge nothing more of it. Its session cannot go on
 * here: the replicas join again later.
 */
export class LogExtendedError extends Error {
  constructor(page: PageId, seq: Seq) {
    super(`the session log of page ${page} already has seq ${seq}`);
    this.name = 'LogExtendedError';
  }
}

/** The replicas that have a page open. */
export interface Collaborators {
  /** Tells the replica of `id`, in the session of `page`, that its operation is in the log at `seq`. */
  ack(page: PageId, id: Id, seq: Seq): void;
}

/**
 * The session log of one page as this instance of Editing extends it: it knows the last `seq` of
 * the page, read when the page is opened and advanced by each append.
 */
export class PageLog {
  readonly page: PageId;
  readonly #log: SessionLog;
  readonly #collaborators: Collaborators;
  #seq: Seq;

  private constructor(page: PageId, seq: Seq, log: SessionLog, collaborators: Collaborators) {
    this.page = page;
    this.#seq = seq;
    this.#log = log;
    this.#collaborators = collaborators;
  }

  static async open(page: PageId, log: SessionLog, collaborators: Collaborators): Promise<PageLog> {
    return new PageLog(page, await log.lastSeq(page), log, collaborators);
  }

  /** The last `seq` of the page. */
  get seq(): Seq {
    return this.#seq;
  }

  /**
   * Appends an operation the Page Block Tree accepted at the next `seq` of the page and, once the
   * append is committed, acknowledges it to the replica of its id. Returns that `seq`.
   * The caller appends the operations of a page one at a time.
   *
   * If another instance extended the log, it rejects with {@link LogExtendedError} and sends no
   * ack. The `seq` stays where it was, so every later append is refused the same way.
   */
  async append(operation: Operation): Promise<Seq> {
    const seq = this.#seq + 1;
    await this.#log.append(this.page, seq, operation);
    this.#seq = seq;
    this.#collaborators.ack(this.page, operation.id, seq);
    return seq;
  }
}
