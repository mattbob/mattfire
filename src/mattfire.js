import firebase from 'firebase/app';

import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/functions';

/*
import Mattfire from 'mattfire';

const Fire = new Mattfire( firebase_config );

const user = new Fire.db.doc( 'users', '48272830' );
await user.get();

const newsletters = new Fire.db.collection( 'newsletters' ).where( 'owner_id', '==', user.id );
await newsletters.get();

const response = await Fire.function.call( 'my_cloud_function', data );
*/

class Mattfire {
	constructor( config, debug ) {
		this.config = config;

		/**
		 * Initiate Firebase
		 */
		firebase.initializeApp( this.config );

		/**
		 * Set variables
		 */
		this.auth      = firebase.auth();
		this.timestamp = firebase.firestore.Timestamp;
		this.field     = firebase.firestore.FieldValue;

		const db        = firebase.firestore();
		const functions = firebase.functions();

		if ( debug ) functions.useEmulator( 'localhost', '5001' );

		/**
		 * Ensure persistence
		 */
		db.enablePersistence()
			.catch( error => {
				console.error( 'Firestore Persistence Error', error );
			} );

		/**
		 * Talk to Firestore
		 */
		this.db = {
			doc: class Doc {
				constructor( collection, id ) {
					this.data       = {};
					this.collection = collection;
					this.id         = id;
					this.ref        = null;
					this.exists     = false;
				} // constructor()

				async get() {
					let snapshot = {};

					if ( ! this.id ) return; // We absolutely need the item's id

					this.ref = db.collection( this.collection ).doc( this.id );

					// Attempt the query
					try {
						snapshot = await this.ref.get();

					// Catch any errors (often related to permissions or an incorrect collection or id)
					} catch ( error ) {
						console.error( 'FIREBASE ERROR ATTEMPTING TO GET AN ITEM', error.code, error.message );
						this.error = error.message;
						return;
					}

					delete this.error; // There were no errors attempting the query

					// Finally, if the snapshot exists set the data
					this.data   = snapshot.exists ? snapshot.data() : {};
					this.exists = snapshot.exists ? true : false;
				} // get()

				async create( data ) {
					if ( this.id ) {
						this.ref = db.collection( this.collection ).doc( this.id );

						// Attempt the query
						try {
							await this.ref.set( data );

						// Catch any errors
						} catch ( error ) {
							console.error( 'FIREBASE ERROR ATTEMPTING TO CREATE AN ITEM', error.code, error.message );
							this.error = error.message;
							return;
						}
					} else {
						// Attempt the query
						try {
							this.ref = await db.collection( this.collection ).add( data );
							this.id  = this.ref.id;

						// Catch any errors
						} catch ( error ) {
							console.error( 'FIREBASE ERROR ATTEMPTING TO CREATE AN ITEM', error.code, error.message );
							this.error = error.message;
							return;
						}
					}

					delete this.error; // There were no errors attempting the query
					await this.get(); // Get the date for this new item
				} // create()

				async update( data ) {
					if ( ! this.id ) return; // We absolutely need the item's id

					this.ref = db.collection( this.collection ).doc( this.id );

					// Attempt the query
					try {
						await this.ref.update( data );

					// Catch any errors
					} catch ( error ) {
						console.error( 'FIREBASE ERROR ATTEMPTING TO UPDATE AN ITEM', error.code, error.message );
						this.error = error.message;
						return;
					}

					delete this.error; // There were no errors attempting the query

					// If we already have the item's data just merge in the new data to avoid another get request
					if ( Object.keys( this.data ).length ) {
						this.data   = { ...this.data, ...data };
						this.exists = true;

					// Otherwise make sure we have the latest data for the item
					} else {
						await this.get();
					}
				} // update()

				async delete() {
					if ( ! this.id ) return; // We absolutely need the item's id

					this.ref = db.collection( this.collection ).doc( this.id );

					try {
						await this.ref.delete();
					} catch ( error ) {
						console.error( 'FIREBASE ERROR ATTEMPTING TO DELETE AN ITEM', error.code, error.message );
						this.error = error.message;
						return;
					}

					delete this.error; // There were no errors attempting the query

					// Reset the class defaults
					this.id     = null;
					this.exists = false;
					this.data   = {};
				} // delete()
			}, // doc

			collection: class Collection {
				constructor( collection ) {
					this.data       = [];
					this.collection = collection;
					this.ref        = db.collection( this.collection );
					this.queries    = [];
					this.count      = null;
				} // constructor()

				async get() {
					let snapshot = {};

					for ( const query of this.queries ) {
						try {
							this.ref = this.ref.where( query[0], query[1], query[2] );
						} catch ( error ) {
							console.warn( 'FIREBASE ERROR CREATING QUERY', error.code, error.message );
						}
					}

					if ( this.count ) {
						this.ref.limit( this.count );
					}

					// Attempt the query
					try {
						snapshot = await this.ref.get();

					// Catch any errors (often related to permissions or an incorrect collection or id)
					} catch ( error ) {
						console.error( 'FIREBASE ERROR ATTEMPTING TO GET A COLLECTION', error.code, error.message );
						this.error = error.message;
						return;
					}

					if ( ! snapshot.empty ) {
						this.data = snapshot.docs.map( doc => {
							let item = {};

							item.data       = doc.data();
							item.collection = this.collection;
							item.id         = doc.id;
							item.ref        = doc.ref;
							item.exists     = true;

							return item;
						} );
					}
				} // get()

				where( key, operator, value ) {
					this.queries.push( [
						key,
						operator,
						value,
					] );

					return this;
				} // where()

				limit( count ) {
					this.count = count;
					return this;
				} // limit()
			}, // collection
		}; // this.db

		/**
		 * Call cloud functions
		 */
		this.function = {
			call: function( function_name, data ) {
				if ( debug ) console.log( 'CALLABLE:', function_name, new Date(), new Date().getMilliseconds() );

				const cloud_function = functions.httpsCallable( function_name );

				return cloud_function( data )
					.then( response => {
						if ( debug ) console.log( 'CALLABLE RESPONSE:', response.data );

						return response.data;
					} )
					.catch( error => {
						if ( debug ) console.error( 'FIREBASE FUNCTIONS ERROR CODE:', error.code );
						if ( debug ) console.error( 'FIREBASE FUNCTIONS ERROR MESSAGE:', error.message );
						if ( debug ) console.error( 'FIREBASE FUNCTIONS ERROR DETAILS:', error.details );

						throw error;
					} );
			}, // call()

			request: function() {

			}
		}; // this.function

		this.storage = {

		}; // this.storage
	} // constructor()
} // Firebase

export default Mattfire;
