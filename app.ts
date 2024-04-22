import express, { Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import Web3 from 'web3';

const web3 = new Web3('https://mainnet.infura.io/v3/43redsd43rft3bac31148b4aa7bb5e567c355ca');
interface User {
    id: string;
    username: string;
}

interface Message {
    date: Date;
    message: string;
    username: string;
    type: string;
}


interface TransactionInfo {
    date: bigint;
    amount: string;
    walletFrom: string;
    walletTo: string;
}

const app = express();
const server = http.createServer(app);

let users: User[] = [];
const messageList: { [key: string]: Message[] } = {};


app.get('/', (req: Request, res: Response) => {
    res.send({ listUser: users });
});

const io = new SocketIOServer(server, {
    cors: {
        origin: '*'
    }
});
const fetchTransactionInfo = async (txid: string): Promise<TransactionInfo> => {
    try {
        const transaction = await web3.eth.getTransaction(txid);

        console.log(transaction);
        if (transaction) {
             const amount = web3.utils.fromWei(transaction.value, 'ether');
            const block = await web3.eth.getBlock(transaction.blockNumber);
            const timestamp = block.timestamp;
            const date =  timestamp;
            const walletFrom = transaction.from;
            const walletTo = transaction.to;


            return { date, amount, walletFrom, walletTo };
        } else {
            throw new Error("Transaction not found");
        }
    } catch (error) {
        console.error("Error fetching transaction info:", error);
        throw error;
    }
};
const processMessage = async (message: string):  Promise<string> => {
    const txidPattern = /0x([A-Fa-f0-9]{64})/;
    const match = message.match(txidPattern);
    console.log(match)
    if (match) {
        const txid = match[0];
        const transactionInfo = await fetchTransactionInfo(txid);

        return `${message}\nTxid: ${txid}, Date: ${transactionInfo.date}, Amount: ${transactionInfo.amount}, WalletFrom: ${transactionInfo.walletFrom}, WalletTo: ${transactionInfo.walletTo}`;
    } else {
        console.log(message)
        return message;
    }
};
server.listen("3001", () => console.log("Server is running..."));

io.on('connection', (socket: Socket) => {
    console.log(`connection :: ${socket.id}`);

    socket.on('user_connect', (data: { username: string }) => {
        console.log(`user connection  :: ${socket.id}`, data);
        const { username } = data;
        users.push({ id: socket.id, username });
    });

    socket.on("join_room",  (data: { room: string }) => {
        console.log('join room ::', data);
        const {room} = data;
        socket.join(room);
        if (!messageList[room]) {
            messageList[room] = [];
        }
        const user = users.find(user => user.id === socket.id);
        if (user) {
            const {username} = user;
            const systemMessage: Message = {date: new Date(), message: `приєднався до чату`, type: 'system', username};
            messageList[room].push(systemMessage);
            socket.broadcast.to(room).emit('chat_message', systemMessage);
        }
    });

    socket.on("send_message", async (data: { room: string, message: string }) => {
        const {room, message} = data;
        const user = users.find(user => user.id === socket.id);
        if (user) {
            const {username} = user;
            const date = new Date();
            const processMessage1 =  await processMessage(message)
            const newMessage: Message = {date, message:processMessage1, username, type: 'user'};
            messageList[room].push(newMessage);
            if (socket.rooms.has(room)) {
                socket.broadcast.to(room).emit('chat_message', newMessage);
            }
            else {
                console.log(`Користувач ${username} не знаходиться в кімнаті ${room}`);
            }
        }
    });

    socket.on("remove_user_room", (data: { room: string }) => {
        console.log('remove user room ::', data);
        const { room } = data;
        socket.leave(room);
    });

    socket.on("disconnect", () => {
        console.log('disconnect', socket.id);
        let userIndex = users.findIndex((user) => user.id === socket.id);
        if (userIndex !== -1) {
            users.splice(userIndex, 1);
        }
    });
});

export default app;
