const _ = require('lodash');
const amqplib = require('amqplib');
const jsonic = require('jsonic');
const Promise = require('bluebird');

class Service {
	constructor(name) {
		this.name = name;
		this.handlers = [];
	}
	
	add(pattern, fn) {
		if (_.isString(pattern)) pattern = jsonic(pattern);
		if (pattern.event) this.subscribe(pattern.event);
		this.handlers.push({pattern, fn});
	}
	
	handle(msg) {
		const handler = _.find(this.handlers, ({pattern}) => _.isMatch(msg, pattern));
		return handler ? handler.fn(msg) : Promise.reject( new Error("No handler found that matches message"));
	}
	
	async connect() {
		if (! this.connection) this.connection = await amqplib.connect('amqp://localhost');
		return this.connection;
	}
	
	async channelAndQueue(queueName) {
		queueName = queueName || this.name;
		const conn = await this.connect();
		const channel = await conn.createChannel();
		const queue = await channel.assertQueue(queueName);
		return {channel,queue:queue.queue}
	}
	
	async listen() {
		const {channel,queue} = await this.channelAndQueue();
		return channel.consume(queue, async (amqpMsg) => {
			if (! amqpMsg) return;
			const msg = JSON.parse(amqpMsg.content.toString());
			if (! msg) return;
			const response = await this.handle(msg);
			channel.sendToQueue(amqpMsg.properties.replyTo, new Buffer(JSON.stringify(response)));
			channel.ack(amqpMsg);
		});
	}
	
	async request(msg) {
		const {channel,queue} = await this.channelAndQueue(msg.role);
		const resQueue = await channel.assertQueue('', {exclusive: true});
		const promise = new Promise(function (resolve, reject) {
			channel.consume(resQueue.queue, function(amqpMsg) {
				resolve(amqpMsg.content.toString());
				channel.close();
			});
		});
		channel.sendToQueue(queue, new Buffer(JSON.stringify(msg)), {replyTo:resQueue.queue});
		return promise;
	}
	
	async subscribe(event) {
		const {channel,queue} = await this.channelAndQueue();
		channel.assertExchange(event, 'fanout', {durable:false});
		channel.bindQueue(queue, event, '');
	}
	
	async publish(event,msg) {
		msg.event = event;
		const {channel} = await this.channelAndQueue();
		channel.assertExchange(event, 'fanout', {durable:false});
		const jsonBuffer = new Buffer(JSON.stringify(msg));
		channel.publish(event, '', jsonBuffer);
	}

}

module.exports = Service;
