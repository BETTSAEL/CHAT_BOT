const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    nombre: {
        type: DataTypes.STRING,
        defaultValue: 'SinNombre'
    },
    apellidos: {
        type: DataTypes.STRING,
        defaultValue: 'SinApellidos'
    },
    DNI: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    ZELLO: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    ALO45: {
        type: DataTypes.STRING,
        defaultValue: 'pendiente'
    }
});

module.exports = User;
