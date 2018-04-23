'use strict';

/**
 * Issue an amount of asset to an owner's account
 * @param {com.amaris.coin.Issue} issue
 * @transaction
 */
async function issue(tx) {
    // Save the old value of the asset.
    const previousValue = tx.account.amount;

    // Update the asset with the new value.
    tx.account.amount += tx.amount;

    // Get the asset registry for the account.
    const assetRegistry = await getAssetRegistry('com.amaris.coin.account');
    // Update the account in the asset registry.
    await assetRegistry.update(tx.account);

    // Emit an event for the modified account.
    let event = getFactory().newEvent('com.amaris.coin', 'Issued');
    event.account = tx.account;
    event.previousValue = previousValue;
    event.newValue = tx.newValue;
    emit(event);
}

/**
 * Transfer between peers
 * @param {com.amaris.coin.Transfer} transfer
 * @transaction
 */
async function transfer(tx) {
    // Verify that account have enough funds
    if(tx.accountFrom.amount < tx.amount) {
        throw new Error('Insufficient funds!');
    }

    // Update accounts with the new value.
    tx.accountFrom.amount   -= tx.amount;
    tx.accountTo.amount     += tx.amount;

    // Get the asset registry for the accounts.
    const assetRegistry = await getAssetRegistry('com.amaris.coin.account');
    // Update the asset in the asset registry.
    await assetRegistry.updateAll([tx.accountFrom, tx.accountTo]);

    // Emit an event for the modified asset.
    let event = getFactory().newEvent('com.amaris.coin', 'Transfered');
    event.accountFrom   = tx.accountFrom;
    event.accountTo     = tx.accountTo;
    event.amount        = tx.amount;
    emit(event);
}
