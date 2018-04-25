/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
/**
 * Write the unit tests for your transction processor functions here
 */

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const namespace         = 'com.amaris.coin';
const assetType         = 'Account';
const participantType   = 'Customer';
const managerType       = 'Banker';

const assetNS       = namespace + '.' + assetType;
const participantNS = namespace + '.' + participantType;
const managerNS     = namespace + '.' + managerType;

describe('#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common')
        .NetworkCardStoreManager
        .getCardStore( { type: 'composer-wallet-inmemory' } );

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    };

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin';

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection;

    // This is the business network connection the tests will use.
    let businessNetworkConnection;

    // This is the factory for creating instances of types.
    let factory;

    // These are the identities for Alice and Bob.
    const aliceCardName = 'alice';
    const bobCardName = 'bob';

    // This is the identity for our Banker Charlie
    const charlieCardName = 'charlie';

    // These are a list of receieved events.
    let events;

    let businessNetworkName;

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        // Identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);
        const deployerCardName = 'PeerAdmin';

        adminConnection = new AdminConnection({ cardStore: cardStore });

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        };
        const card = new IdCard(metadata, connectionProfile);
        await adminConnection.importCard(cardName, card);
    }

    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        businessNetworkName = businessNetworkDefinition.getName();
        await adminConnection.install(businessNetworkDefinition);
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions);
        await adminConnection.importCard(adminCardName, adminCards.get('admin'));

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', event => {
            events.push(event);
        });
        await businessNetworkConnection.connect(adminCardName);

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        // Create the assets.
        const asset1 = factory.newResource(namespace, assetType, '1');
        asset1.amount = 10;

        const asset2 = factory.newResource(namespace, assetType, '2');
        asset2.amount = 20;

        assetRegistry.addAll([asset1, asset2]);

        let participantRegistry = await businessNetworkConnection.getParticipantRegistry(participantNS);
        // Create the participants.
        const alice = factory.newResource(namespace, participantType, 'alice@email.com');
        alice.account = factory.newRelationship(namespace, assetType, '1');
        alice.firstName = 'Alice';
        alice.lastName = 'Wonder';

        const bob = factory.newResource(namespace, participantType, 'bob@email.com');
        bob.account = factory.newRelationship(namespace, assetType, '2');
        bob.firstName = 'Bob';
        bob.lastName = 'Dilan';

        participantRegistry.addAll([alice, bob]);

        // Create the managers.
        const charlie = factory.newResource(namespace, managerType, 'charlie@email.com');
        charlie.firstName = 'Charlie';
        charlie.lastName = 'Chaplin';

        const managerRegistry = await businessNetworkConnection.getParticipantRegistry(managerNS);
        managerRegistry.add(charlie);

        // Issue the identities.
        let identity = await businessNetworkConnection.issueIdentity(participantNS + '#alice@email.com', 'alice1');
        await importCardForIdentity(aliceCardName, identity);
        identity = await businessNetworkConnection.issueIdentity(participantNS + '#bob@email.com', 'bob1');
        await importCardForIdentity(bobCardName, identity);
        identity = await businessNetworkConnection.issueIdentity(managerNS + '#charlie@email.com', 'charlie1');
        await importCardForIdentity(charlieCardName, identity);
    });

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The name of the card for the identity to use
     */
    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect();
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', (event) => {
            events.push(event);
        });
        await businessNetworkConnection.connect(cardName);
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    }

    it('Alice can read her account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        const assets = await assetRegistry.getAll();

        // Alice can have access to Bob's account
        assets.should.have.lengthOf(2);

        // Validate the assets.
        assets[0].amount.should.equal(10);
        assets[1].amount.should.equal(20);
    });

    it('Bob can read his account', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        const assets = await assetRegistry.getAll();

        // Bob cannot have access to Alice's account
        assets.should.have.lengthOf(2);

        // Validate the assets.
        //asset2.owner.getFullyQualifiedIdentifier().should.equal(participantNS + '#bob@email.com');
        assets[0].amount.should.equal(10);
        assets[1].amount.should.equal(20);
    });

    it('Alice cannot create a new account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Create the asset.
        let asset3 = factory.newResource(namespace, assetType, '3');
        asset3.amount = 30;

        // Add the asset, then get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.add(asset3).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Bob cannot create a new account', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Create the asset.
        let asset3 = factory.newResource(namespace, assetType, '3');
        asset3.amount = 30;

        // Add the asset, then get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.add(asset3).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Charlie can create an account for a new customer', async () => {
        // Use the identity for Charlie.
        await useIdentity(charlieCardName);

        // Create the asset.
        let asset3 = factory.newResource(namespace, assetType, '3');
        asset3.amount = 30;

        // Add the asset, then get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        await assetRegistry.add(asset3);

        // Create a new participant
        const dan = factory.newResource(namespace, participantType, 'dan@email.com');
        dan.account = factory.newRelationship(namespace, assetType, '3');
        dan.firstName = 'Dan';
        dan.lastName = 'Kreig';

        const participantRegistry = await businessNetworkConnection.getParticipantRegistry(participantNS);
        await participantRegistry.add(dan);

        // Validate the asset.
        asset3 = await assetRegistry.get('3');
        //asset3.owner.getFullyQualifiedIdentifier().should.equal(participantNS + '#alice@email.com');
        asset3.amount.should.equal(30);
    });

    it('Charlie can issue an account', async () => {
        // Use the identity for Charlie.
        await useIdentity(charlieCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Issue');
        transaction.account = factory.newRelationship(namespace, assetType, '1');
        transaction.amount = 42.1337;
        await businessNetworkConnection.submitTransaction(transaction);

        // Get the account.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        const asset1 = await assetRegistry.get('1');

        // Validate the account.
        asset1.amount.should.equal(52.1337);

        // Validate the events.
        events.should.have.lengthOf(1);
        const event = events[0];
        event.eventId.should.be.a('string');
        event.timestamp.should.be.an.instanceOf(Date);
        event.account.getFullyQualifiedIdentifier().should.equal(assetNS + '#1');
        event.previousValue.should.equal(10);
        event.newValue.should.equal(52.1337);
    });

    it('Charlie can remove an account', async () => {
        // Use the identity for Charlie.
        await useIdentity(charlieCardName);

        // Remove the asset, then test the asset exists.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        await assetRegistry.remove('1');
        const exists = await assetRegistry.exists('1');
        exists.should.be.false;
    });

    it('Alice cannot issue her account', async () => {
        // Use the identity for Charlie.
        await useIdentity(aliceCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Issue');
        transaction.account = factory.newRelationship(namespace, assetType, '1');
        transaction.amount = 100;
        businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Alice cannot update her assets', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Create the asset.
        let asset1 = factory.newResource(namespace, assetType, '1');
        asset1.amount = 50;

        // Update the asset, then get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.update(asset1).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Alice cannot update Bob\'s account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Create the asset.
        const asset2 = factory.newResource(namespace, assetType, '2');
        asset2.amount = 50;

        // Try to update the asset, should fail.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.update(asset2).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Bob cannot issue his account', async () => {
        // Use the identity for Charlie.
        await useIdentity(bobCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Issue');
        transaction.account = factory.newRelationship(namespace, assetType, '2');
        transaction.amount = 7.9;
        businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Bob cannot update his assets', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Create the asset.
        let asset2 = factory.newResource(namespace, assetType, '2');
        asset2.amount = 60;

        // Update the asset, then get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.update(asset2).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Bob cannot update Alice\'s account', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Create the asset.
        const asset1 = factory.newResource(namespace, assetType, '1');
        asset1.amount = 60;

        // Update the asset, then get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.update(asset1).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Alice can remove her account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Remove the asset, then test the asset exists.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        await assetRegistry.remove('1');
        const exists = await assetRegistry.exists('1');
        exists.should.be.false;
    });

    it('Alice cannot remove Bob\'s account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Remove the asset, then test the asset exists.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.remove('2').should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Bob can remove his account', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Remove the asset, then test the asset exists.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        await assetRegistry.remove('2');
        const exists = await assetRegistry.exists('2');
        exists.should.be.false;
    });

    it('Bob cannot remove Alice\'s account', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Remove the asset, then test the asset exists.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        assetRegistry.remove('1').should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Alice can submit a transaction from her account to bob\'s account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Transfer');
        transaction.from = factory.newRelationship(namespace, assetType, '1');
        transaction.to = factory.newRelationship(namespace, assetType, '2');
        transaction.amount = 0.3;
        await businessNetworkConnection.submitTransaction(transaction);

        // Get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        const asset1 = await assetRegistry.get('1');
        const asset2 = await assetRegistry.get('2');

        // Validate the asset.
        asset1.amount.should.equal(9.7);
        asset2.amount.should.equal(20.3);

        // Validate the events.
        events.should.have.lengthOf(1);
        const event = events[0];
        event.eventId.should.be.a('string');
        event.timestamp.should.be.an.instanceOf(Date);
        event.from.getFullyQualifiedIdentifier().should.equal(assetNS + '#1');
        event.to.getFullyQualifiedIdentifier().should.equal(assetNS + '#2');
        event.amount.should.equal(0.3);
    });

    it('Alice cannot submit a transaction from Bob\'s account', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Transfer');
        transaction.from = factory.newRelationship(namespace, assetType, '2');
        transaction.to = factory.newRelationship(namespace, assetType, '1');
        transaction.amount = 1.5;
        businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Alice cannot submit a transaction with not enough funds', async () => {
        // Use the identity for Alice.
        await useIdentity(aliceCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Transfer');
        transaction.from = factory.newRelationship(namespace, assetType, '1');
        transaction.to = factory.newRelationship(namespace, assetType, '2');
        transaction.amount = 10.5;
        businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith('Insufficient funds!');
    });

    it('Bob can submit a transaction for his assets', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Transfer');
        transaction.from = factory.newRelationship(namespace, assetType, '2');
        transaction.to = factory.newRelationship(namespace, assetType, '1');
        transaction.amount = 0.01;
        await businessNetworkConnection.submitTransaction(transaction);

        // Get the asset.
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS);
        const asset1 = await assetRegistry.get('1');
        const asset2 = await assetRegistry.get('2');

        // Validate the asset.
        asset1.amount.should.equal(10.01);
        asset2.getFullyQualifiedIdentifier().should.equal(assetNS + '#2');
        asset2.amount.should.equal(19.99);

        // Validate the events.
        events.should.have.lengthOf(1);
        const event = events[0];
        event.eventId.should.be.a('string');
        event.timestamp.should.be.an.instanceOf(Date);
        event.from.getFullyQualifiedIdentifier().should.equal(assetNS + '#2');
        event.to.getFullyQualifiedIdentifier().should.equal(assetNS + '#1');
        event.amount.should.equal(0.01);
    });

    it('Bob cannot submit a transaction from Alice\'s account', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Transfer');
        transaction.from = factory.newRelationship(namespace, assetType, '1');
        transaction.to = factory.newRelationship(namespace, assetType, '2');
        transaction.amount = 7;
        businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(/does not have .* access to resource/);
    });

    it('Bob cannot submit a transaction with not enough funds', async () => {
        // Use the identity for Bob.
        await useIdentity(bobCardName);

        // Submit the transaction.
        const transaction = factory.newTransaction(namespace, 'Transfer');
        transaction.from = factory.newRelationship(namespace, assetType, '2');
        transaction.to = factory.newRelationship(namespace, assetType, '1');
        transaction.amount = 20.01;
        businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith('Insufficient funds!');
    });

});
