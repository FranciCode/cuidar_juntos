module.exports = (session) => {
  class MysqlSessionStore extends session.Store {
    constructor(getPool, options = {}) {
      super();
      this.getPool = getPool;
      this.ttl = options.ttl || 1000 * 60 * 60 * 4;
      this.ready = null;
    }

    async db() {
      const pool = await this.getPool();
      if (!this.ready) {
        this.ready = pool.query(
          "CREATE TABLE IF NOT EXISTS sessoes (sid VARCHAR(128) PRIMARY KEY, dados TEXT NOT NULL, expira_em BIGINT NOT NULL, INDEX idx_sessoes_expira (expira_em))"
        ).catch((e) => { this.ready = null; throw e; });
      }
      await this.ready;
      return pool;
    }

    expiry(sess) {
      const exp = sess && sess.cookie && sess.cookie.expires;
      return exp ? new Date(exp).getTime() : Date.now() + this.ttl;
    }

    get(sid, cb) {
      this.db().then((db) => db.query("SELECT dados FROM sessoes WHERE sid = ? AND expira_em > ?", [sid, Date.now()]))
        .then(([rows]) => cb(null, rows.length ? JSON.parse(rows[0].dados) : null))
        .catch((e) => cb(e));
    }

    set(sid, sess, cb = () => {}) {
      this.db().then((db) => db.query(
        "INSERT INTO sessoes (sid, dados, expira_em) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE dados = VALUES(dados), expira_em = VALUES(expira_em)",
        [sid, JSON.stringify(sess), this.expiry(sess)]
      ))
        .then(() => {
          if (Math.random() < 0.02) this.db().then((db) => db.query("DELETE FROM sessoes WHERE expira_em < ?", [Date.now()])).catch(() => {});
          cb(null);
        })
        .catch((e) => cb(e));
    }

    touch(sid, sess, cb = () => {}) {
      this.db().then((db) => db.query("UPDATE sessoes SET expira_em = ? WHERE sid = ?", [this.expiry(sess), sid]))
        .then(() => cb(null)).catch((e) => cb(e));
    }

    destroy(sid, cb = () => {}) {
      this.db().then((db) => db.query("DELETE FROM sessoes WHERE sid = ?", [sid]))
        .then(() => cb(null)).catch((e) => cb(e));
    }
  }
  return MysqlSessionStore;
};
