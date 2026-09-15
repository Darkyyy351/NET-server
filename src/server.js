require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  require('./services/availability.service').start();
  console.log(`NET Backend running on port ${PORT}`);
});
