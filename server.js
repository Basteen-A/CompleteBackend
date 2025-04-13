require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const plantRouter = require('./routes/plant');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount existing routers
// app.use('/api/plant', plantRouter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/fields', require('./routes/fields'));
app.use('/api/bills', require('./routes/bills'));

// Mount the new IoT router
app.use('/api/iot', require('./routes/iot'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
