import { namespaceWrapper } from '@_koii/namespace-wrapper';
import { main } from './main.js';

export async function task(roundNumber) {
  // Run your task and store the proofs to be submitted for auditing
  // The submission of the proofs is done in the submission function
  try {
    console.log(`EXECUTE TASK FOR ROUND ${roundNumber}`);
    const cid = await main(roundNumber);
    // console.log('Started Task', new Date(), 'TEST');
    // you can optionally return this value to be used in debugging
    await namespaceWrapper.storeSet(roundNumber, cid);
  } catch (error) {
    console.error('EXECUTE TASK ERROR:', error);
  }
}
