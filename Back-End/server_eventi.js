const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());
const db = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	database: 'full_stack',
});

db.on('error', (err) => {
	console.error('Errore durante la connessione al database:', err);
	throw err;
});
db.connect((err) => {
	if (err) {
		console.error('Errore durante la connessione al database:', err);
		throw err;
	}
	console.log('Connected to database');
});
app.get('/api/events/user/:userId', (req, res) => {
	const userId = req.params.userId;
	db.query(
		'SELECT * FROM dati_eventi WHERE id_utente = ?',
		[userId],
		(err, result) => {
			if (err) {
				console.error('Error fetching events:', err);
				return res.status(500).json({ error: 'Internal Server Error' });
			}
			if (result) {
				const data_evento = result[0].data_evento.toLocaleDateString();
				result[0].data_evento = data_evento;
			}
			res.setHeader('Content-Type', 'application/json');
			const modifiedResult = result.map((event) => {
				const date = new Date(event.data_creazione);
				const options = {
					year: 'numeric',
					month: 'numeric',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				};
				event.data_creazione = date.toLocaleDateString('it-IT', options);
				return event;
			});

			const data = JSON.stringify(modifiedResult);
			console.log(typeof data);
			res.json(data);
		}
	);
});

app.post('/api/event/user/:userId', (req, res) => {
	const userId = req.params.userId;
	const {
		nome_evento,
		descrizione,
		tipo,
		colore_evento,

		ora_evento,
		data_evento,
	} = req.body;

	if (!nome_evento || !descrizione || !tipo) {
		return res.status(400).json({
			error: 'I campi nome_evento, descrizione e tipo sono obbligatori',
		});
	}

	const dateObject = new Date(data_evento);
	const formattedDate = dateObject.toLocaleDateString('en-CA'); // 'en-CA' gives you the format 'YYYY-MM-DD'
	console.log(formattedDate);
	const eventData = {
		nome_evento,
		descrizione,
		tipo,
		data: formattedDate,
		colore_evento,
		ora_evento,
	};
	const eventDataJson = JSON.stringify(eventData);
	let now = new Date();
	const dd = now.getDay();
	const mm = now.getMonth(); //January is 0!
	const yyyy = now.getFullYear();
	const hours = now.getHours();
	const minutes = now.getMinutes();
	const seconds = now.getSeconds();

	const data_creazione = `${yyyy}-${mm}-${dd} ${hours}:${minutes}:${seconds}`;
	db.query(
		'INSERT INTO dati_eventi (colore_evento, nome_evento, descrizione, data_evento,ora_evento,tipo_evento, data_creazione,id_utente) VALUES (?, ?, ?, ?, ?,?,?,?)',
		[
			colore_evento,
			nome_evento,
			descrizione,
			formattedDate,
			ora_evento,
			tipo,
			data_creazione,
			userId,
		],
		(err, result) => {
			if (err) {
				console.error("Errore durante l'inserimento dei dati:", err);
				return res
					.status(500)
					.json({ error: "Errore durante l'inserimento dei dati" });
			}

			console.log('Dati inseriti con successo:', eventDataJson);
			res.status(201).json({
				message: 'Event created successfully',
				data: eventDataJson,
			});
		}
	);
});

// Aggiungi eventuali altre route qui

app.patch('/api/event/:id', (req, res) => {
	const { id } = req.params;
	const {
		colore_evento,
		nome_evento,
		descrizione,
		tipo,
		ora_evento,
		data_evento,
	} = req.body;
	console.log(req.body);
	db.query(
		'UPDATE dati_eventi SET colore_evento=?, nome_evento = ?, descrizione = ?, data_evento = ?, ora_evento = ?, tipo_evento = ? WHERE id = ?',
		[
			colore_evento,
			nome_evento,
			descrizione,
			data_evento,
			ora_evento,
			tipo,
			id,
		],
		(err, result) => {
			if (err) {
				throw err;
			}
			if (result.affectedRows === 0) {
				return res.status(404).json({ message: 'Event not found' });
			}

			res.json({ message: 'Event updated successfully' });
		}
	);
});

app.delete('/api/event/:id', (req, res) => {
	const { id } = req.params;
	db.query('DELETE FROM dati_eventi WHERE id = ?', [id], (err, result) => {
		if (err) {
			throw err;
		}
		if (result.affectedRows === 0) {
			return res.status(404).json({ message: 'Event not found' });
		}

		console.log('eliminato correttamente');
		res.sendStatus(204);
	});
});

//  AUTENTICAZIONE

const jwt = require('jsonwebtoken');
// Registrazione

app.post('/api/auth/register', (req, res, next) => {
	console.log('ciao');
	const data = req.body;
	console.log(req.body);
	const token = jwt.sign({ data }, 'key', { expiresIn: '1y' });
	db.query(
		'SELECT * FROM utenti WHERE nome_utente = ? AND email = ? AND password = ?',
		[data.username, data.email, data.password],
		(err, result) => {
			if (err) {
				console.error("errore durante la creazione dell'account:", err);
				return res
					.status(500)
					.json({ error: "Errore durante l'inserimento dei dati" });
			}
			if (result.length > 0) {
				// User already exists
				console.log('User already exists');
				return res.status(400).json({
					error:
						'User with the same username, password and email already exists',
				});
			}
			db.query(
				'INSERT INTO utenti (nome_utente, email, password, token) VALUES (?, ?,?,?)',
				[data.username, data.email, data.password, token],
				(err, result) => {
					if (err) {
						console.error("Errore durante l'inserimento dei dati:", err);
						return res
							.status(500)
							.json({ error: "Errore durante l'inserimento dei dati" });
					}
				}
			);
			res.json({ token });
		}
	);
});

//Login

app.post('/api/auth/login', (req, res, next) => {
	console.log('Login');
	const data = req.body;
	console.log(req.body);
	const tokenBeforeQuery = jwt.sign({ data }, 'key', { expiresIn: '1s' });
	db.query(
		'SELECT * FROM utenti WHERE nome_utente = ? AND email = ? AND password = ?',
		[req.body.username, req.body.email, req.body.password],
		async (err, result) => {
			if (err) {
				console.error("errore durante l'accesso all'account:", err);
				return res
					.status(500)
					.json({ error: "Errore durante l'inserimento dei dati" });
			}
			if (result.length === 0) {
				// User doesn't exist
				console.log('user doesnt exist, sign up');
				return res.status(400).json({
					error: 'user doesnt exist, sign up',
				});
			}
			console.log(result);
			const id = result[0].id_utente;

			const tokenAfterQuery = jwt.sign({ userId: result[0].id }, 'key', {
				expiresIn: '1h',
			});
			res.json({
				userData: {
					id: result[0].id_utente,
					username: data.username,
					email: data.email,
					password: data.password,
					token: tokenAfterQuery,
				},
			});
		}
	);
});

// AMICI
// app.post('/api/user/:userId/friend', (req, res) => {
// 	const userId = req.params.userId;
// 	console.log(userId);
// 	const data = req.body;
// 	let id_amico;
// 	console.log('body', req.body);
// 	db.query(
// 		'SELECT id_utente FROM utenti WHERE nome_utente = ? ',
// 		[req.body.nome_amico],
// 		(err, result) => {
// 			if (err) {
// 				console.error("errore durante l'accesso all'account:", err);
// 				return res
// 					.status(500)
// 					.json({ error: "Errore durante l'inserimento dei dati" });
// 			}
// 			if (result.length === 0) {
// 				// User doesn't exist
// 				console.log('friend doesnt exist');
// 				return res.status(400).json({
// 					error: 'user doesnt exist, sign up',
// 				});
// 			}
// 			if (result) {
// 				console.log('result');
// 				res
// 					.status(200)
// 					.json({ id_utente: userId, id_amico: result[0].id_utente });
// 				id_amico = result[0].id_utente;
// 				db.query(
// 					'INSERT INTO amici_utenti (id_utente, id_amico) VALUES(?,?)',
// 					[userId, id_amico],
// 					(err, result) => {
// 						if (err) {
// 							console.error("errore durante l'accesso all'account:", err);
// 							return res
// 								.status(500)
// 								.json({ error: "Errore durante l'inserimento dei dati" });
// 						}
// 						if (result) {
// 						}
// 					}
// 				);
// 			}
// 			console.log(result);

// 			const tokenAfterQuery = jwt.sign({ userId: result[0].id }, 'key', {
// 				expiresIn: '1h',
// 			});
// 		}
// 	);
// });

// app.get('/api/user/:userId/friends', (req, res) => {
// 	const userId = req.params.userId;
// 	console.log(userId);
// 	db.query(
// 		'SELECT id_amico FROM amici_utenti WHERE id_utente = ?',
// 		[userId],
// 		(err, result) => {
// 			if (result) {
// 				console.log('result id', result);
// 				res.json({ result });
// 			}

// 			if (err) {
// 				console.log(err);
// 			}
// 		}
// 	);
// });
// app.get('/api/user/:userId/friend', (req, res) => {
// 	const userId = req.params.userId;
// 	console.log(userId);
// 	db.query(
// 		'SELECT * FROM utenti WHERE id_utente = ?',
// 		[userId],
// 		(err, result) => {
// 			if (result) {
// 				console.log('result', result);
// 				const amici = result.forEach((item) => {
// 					const transformedItem = {
// 						userData: {
// 							username: item.nome_utente,
// 							email: item.email,
// 							password: item.password,
// 						},
// 					};
// 					console.log('transformedItem', transformedItem);
// 					res.json(transformedItem);
// 				});
// 				// res.json({
// 				// 	userData: {
// 				// 		username: result.username,
// 				// 		email: result.email,
// 				// 		password: result.password,
// 				// 	},
// 				// });
// 			}

// 			if (err) {
// 				console.log(err);
// 			}
// 		}
// 	);
// });

app.post('/api/user/:userId/friend-request', (req, res) => {
	console.log('ciao');
	const userId = req.params.userId;
	const friendName = req.body.nome_amico;

	// Cerca l'ID dell'amico dal nome
	db.query(
		'SELECT id_utente FROM utenti WHERE nome_utente = ?',
		[friendName],
		(err, result) => {
			if (err) {
				console.error("Errore durante la ricerca dell'amico:", err);
				return res
					.status(500)
					.json({ error: "Errore durante l'inserimento dei dati" });
			}
			if (result.length === 0) {
				// L'utente non esiste
				console.log("L'amico non esiste");
				return res
					.status(400)
					.json({ error: "L'utente non esiste, registrati" });
			}
			console.log(result);
			const friendId = result[0].id_utente;
			console.log('da', userId);
			console.log('A', friendId);
			// Inserisce la richiesta di amicizia nel database
			db.query(
				'INSERT INTO richieste_amicizia (id_utente_da, id_utente_a) VALUES (?, ?)',
				[userId, friendId],
				(err, result) => {
					if (err) {
						console.error(
							"Errore durante l'inserimento della richiesta di amicizia:",
							err
						);
						return res
							.status(500)
							.json({ error: "Errore durante l'inserimento dei dati" });
					}
					console.log('Richiesta di amicizia inviata con successo');
					res
						.status(200)
						.json({ message: 'Richiesta di amicizia inviata con successo' });
				}
			);
		}
	);
});
app.patch('/api/friend-request/:requestId/accept', (req, res) => {
	const requestId = req.params.requestId;

	// Aggiorna lo stato della richiesta di amicizia nel database
	db.query(
		'UPDATE richieste_amicizia SET stato = "accettata" WHERE id_richiesta = ?',
		[requestId],
		(err, result) => {
			if (err) {
				console.error(
					"Errore durante l'accettazione della richiesta di amicizia:",
					err
				);
				return res
					.status(500)
					.json({ error: "Errore durante l'aggiornamento dei dati" });
			}
			console.log('Richiesta di amicizia accettata con successo');
			res
				.status(200)
				.json({ message: 'Richiesta di amicizia accettata con successo' });
		}
	);
});

// API per ottenere le richieste di amicizia per un determinato utente
app.get('/api/user/:userId/friend-requests', (req, res) => {
	const userId = req.params.userId;
	console.log(userId);

	// Ottiene le richieste di amicizia per l'utente specificato
	db.query(
		'SELECT * FROM richieste_amicizia WHERE id_utente_a = ?',
		[userId],
		(err, result) => {
			if (err) {
				console.error(
					'Errore durante il recupero delle richieste di amicizia:',
					err
				);
				return res
					.status(500)
					.json({ error: 'Errore durante il recupero dei dati' });
			}
			console.log('Richieste di amicizia ottenute con successo');
			res.status(200).json(result);
		}
	);
});
app.get('/api/user/:userId/friendsId', (req, res) => {
	const userId = req.params.userId;

	// Ottiene gli amici per l'utente specificato
	db.query(
		'SELECT * FROM amici_utenti WHERE id_utente_a = ?',
		[userId],
		(err, result) => {
			if (err) {
				console.error('Errore durante il recupero degli amici:', err);
				return res
					.status(500)
					.json({ error: 'Errore durante il recupero dei dati' });
			}
			console.log('Amici ottenuti con successo');
			res.status(200).json(result);
		}
	);
});
app.get('/api/user/:userId/friends', (req, res) => {
	const userId = req.params.userId;
	const id = req.body;

	db.query(
		'SELECT * FROM utenti WHERE id_utente = ?',
		[userId],
		(err, result) => {
			if (err) {
				console.error('Errore durante il recupero degli amici:', err);
				return res
					.status(500)
					.json({ error: 'Errore durante il recupero dei dati' });
			}
			console.log('Amici ottenuti con successo');
			res.status(200).json(result);
		}
	);
});
app.get('/api/user/:userId/friend-requests', (req, res) => {});
const PORT = process.env.PORT || 3000; // Cambia la porta se necessario
app.listen(PORT);
