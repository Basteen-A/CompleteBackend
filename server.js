require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
// const iotRoutes = require('./routes/iot');

app.use(cors());
app.use(express.json());


// app.use('/iot', iotRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/fields', require('./routes/fields'));
app.use('/api/bills', require('./routes/bills'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));