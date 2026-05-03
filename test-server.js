const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Test server running' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Test server running on port ${port}`);
});

// Keep alive
setInterval(() => {
    console.log('💓 Heartbeat');
}, 30000);