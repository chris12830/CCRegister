declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SUPER_ADMIN_EMAIL?: string;
    BUSINESS_ADMIN_EMAIL?: string;
  }
}
