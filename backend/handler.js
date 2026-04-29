const serverless = require('serverless-http');
const app = require('./app');

const httpHandler = serverless(app);

module.exports.handler = async (event, context) => {
  // Direct Lambda invocation for DB migrations (bypasses API Gateway path)
  if (event && event.type === 'migration') {
    const fs   = require('fs');
    const path = require('path');
    const { query } = require('./db/pool');
    const file = event.file; // e.g. 'schema' or 'seed'
    const sql  = fs.readFileSync(path.join(__dirname, 'db', `${file}.sql`), 'utf8');
    await query(sql);
    return { status: 'done', file };
  }
  return httpHandler(event, context);
};

// Local dev
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}
