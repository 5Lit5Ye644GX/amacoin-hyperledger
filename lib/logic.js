'use strict';

/**
 * Issue an amount of asset to an owner's account
 * @param {com.amaris.coin.Issue} tx
 * @transaction
 */
async function issue(tx) {
    // Save the old value of the asset.
    const previousValue = tx.account.amount;

    // Update the asset with the new value.
    tx.account.amount += tx.amount;

    // Get the asset registry for the account.
    const assetRegistry = await getAssetRegistry('com.amaris.coin.Account');
    // Update the account in the asset registry.
    await assetRegistry.update(tx.account);

    // Emit an event for the modified account.
    let event = getFactory().newEvent('com.amaris.coin', 'Issued');
    event.account = tx.account;
    event.previousValue = previousValue;
    event.newValue = tx.account.amount;
    emit(event);
}


/**
 * Transfer between peers
 * @param {com.amaris.coin.Transfer} tx
 * @transaction
 */
async function transfer(tx) {
    // Verify that account have enough funds
    if(tx.from.amount < tx.amount) {
        throw new Error('Insufficient funds!');
    }

    // Update accounts with the new value.
    tx.from.amount   -= tx.amount;
    tx.to.amount     += tx.amount;

    // Get the asset registry for the accounts.
    const assetRegistry = await getAssetRegistry('com.amaris.coin.Account');
    // Update the asset in the asset registry.
    await assetRegistry.updateAll([tx.from, tx.to]);

    // Emit an event for the modified asset.
    let event = getFactory().newEvent('com.amaris.coin', 'Transfered');
    event.from   = tx.from;
    event.to     = tx.to;
    event.amount = tx.amount;
    emit(event);
}
