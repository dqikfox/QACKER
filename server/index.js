'use strict';

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`QACKER dashboard listening on http://localhost:${PORT}`);
  });
}

module.exports = { createApp };
