import { app } from '@azure/functions';
import { diffAndStoreFactory } from '../../shared/diffFactory.js';

// Assuming smart process items map to entity "item" for fields API; adjust if different (e.g., dynamic type code required).
const handler = diffAndStoreFactory('item');
app.http('crm-spitems-custom-fields',{ methods:['GET'], authLevel:'anonymous', route:'crm/spitems/custom-fields/get', handler });
