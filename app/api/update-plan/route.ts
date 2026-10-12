import {json} from '../../../server/catalogue';
import sources from '../../../public/source-registry.json';
import plan from '../../../public/collection-plan.json';
export async function GET(){return json({...plan,sourceRegistry:sources});}
