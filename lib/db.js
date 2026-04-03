import { MongoClient ,ObjectId} from "mongodb";
import dotenv from "dotenv";
dotenv.config();
const url = process.env.MONGO_URI;
const dbName = "myapp";
const client = new MongoClient(url);
let dbConnection = null;

async function connectDb() {
  try {
    if (dbConnection) return dbConnection;
    await client.connect();
    dbConnection = client.db(dbName);
    return dbConnection;
  } catch (error) {
    console.error("Error in connection to Data ", error);
    throw error;
  }
}

export async function getCollection(collectionName) {
  try {
    const db = await connectDb();
    const collection = db.collection(collectionName);
    return collection;
  } catch (error) {
    console.error("error in getting collection", error);
    throw error;
  }
}


 export function toObjectId(id){
    if(!ObjectId.isValid(id)){
        throw new Error("invalid ObjectId",id)
    }
    return new ObjectId(id)
}
