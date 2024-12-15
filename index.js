const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const port = 5000;


app.use(cors());
app.use(express.json());


const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'webshop'
});


db.connect((err) => {
  if (err) {
    console.error('Hiba a DB kapcsolatban: ', err);
    return;
  }
  console.log('Adatbázis csatlakoztatva');
});


app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  
  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Hiba történt' });
    if (results.length > 0) return res.status(400).json({ error: 'Ez a felhasználónév már létezik!' });

 
    const hashedPassword = await bcrypt.hash(password, 10);

    
    db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ error: 'Hiba történt a regisztráció során' });
      res.status(200).json({ message: 'Regisztráció sikeres' });
    });
  });
});


app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Hiba történt' });
    if (results.length === 0) return res.status(400).json({ error: 'Felhasználónév vagy jelszó hibás' });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Felhasználónév vagy jelszó hibás' });
    }

    
    const token = jwt.sign({ id: user.id, username: user.username }, 'secretKey', { expiresIn: '1h' });
    res.status(200).json({ message: 'Bejelentkezés sikeres', token, userId: user.id });
  });
});


app.get('/users/:id', (req, res) => {
  const userId = req.params.id;

  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Hiba történt' });
    if (results.length === 0) return res.status(404).json({ error: 'Felhasználó nem található' });

    res.status(200).json(results[0]);
  });
});


app.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { username, password } = req.body;

  
  db.query('SELECT * FROM users WHERE id = ?', [userId], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Hiba történt' });
    if (results.length === 0) return res.status(404).json({ error: 'Felhasználó nem található' });

    
    if (username && username !== results[0].username) {
      db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ error: 'Hiba történt' });
        if (results.length > 0) return res.status(400).json({ error: 'Ez a felhasználónév már létezik!' });

       
        updateUser();
      });
    } else {
      updateUser();
    }

    
    async function updateUser() {
      const hashedPassword = password ? await bcrypt.hash(password, 10) : results[0].password;

      db.query('UPDATE users SET username = ?, password = ? WHERE id = ?', [username || results[0].username, hashedPassword, userId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Hiba történt a profil frissítésekor' });
        res.status(200).json({ message: 'Profil frissítve' });
      });
    }
  });
});


app.get('/cart/:userId', (req, res) => {
  const userId = req.params.userId;
  db.query('SELECT products.id, products.name, products.price FROM cart JOIN products ON cart.product_id = products.id WHERE cart.user_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Hiba történt' });
    res.status(200).json(results);
  });
});

app.get('/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Hiba történt a termékek lekérésekor' });
    }
    res.status(200).json(results);
  });
});


app.post('/cart/:userId', (req, res) => {
  const userId = req.params.userId;
  const { productId } = req.body;

  
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  db.query('INSERT INTO cart (user_id, product_id) VALUES (?, ?)', [userId, productId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error adding product to cart' });
    }
    res.status(200).json({ message: 'Product added to cart' });
  });
});


app.delete('/cart/:userId/:productId', (req, res) => {
  const { userId, productId } = req.params;
  db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Hiba történt a termék eltávolításakor' });
    res.status(200).json({ message: 'Termék eltávolítva a kosárból' });
  });
});


app.delete('/cart/:userId', (req, res) => {
  const userId = req.params.userId;
  db.query('DELETE FROM cart WHERE user_id = ?', [userId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Hiba történt a kosár ürítésekor' });
    res.status(200).json({ message: 'Kosár kiürítve' });
  });
});


app.listen(port, () => {
  console.log(`Backend elindítva a porton: ${port}`);
});
