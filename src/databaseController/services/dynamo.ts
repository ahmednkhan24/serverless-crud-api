import { config, DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  DynamoGetAllItemsParams,
  DynamoGetItemParams,
  DynamoPutItemParams,
  DynamoUpdateItemParams,
  DynamoDeleteItemParams,
} from './types';

config.update({
  region: 'us-east-2',
});

const dynamo = new DynamoDB.DocumentClient();

const TABLE_NAME = process.env.DB_TABLE_NAME || 'Sample_Database';

export const getAllItems = async () => {
  console.log(`starting scan on the ${TABLE_NAME} database table...`);

  let data = await dynamo
    .scan({ TableName: TABLE_NAME } as DynamoGetAllItemsParams)
    .promise();
  let databaseItems = [...data.Items];

  // scan maxes out at 1MB of data. continue scanning if there is more data to read
  while (typeof data.LastEvaluatedKey !== 'undefined') {
    console.log('Scanning for more...');

    const params: DynamoGetAllItemsParams = {
      TableName: TABLE_NAME,
      ExclusiveStartKey: data.LastEvaluatedKey,
    };

    data = await dynamo.scan(params).promise();
    databaseItems = [...databaseItems, ...data.Items];
  }

  console.log(
    `Finished scanning all database items from the ${TABLE_NAME} table.`
  );
  console.log(`Scanned ${databaseItems.length} items.`);

  return databaseItems;
};

export const getItem = async (id: string) => {
  const params: DynamoGetItemParams = {
    TableName: TABLE_NAME,
    Key: {
      id,
    },
  };

  return dynamo.get(params).promise();
};

export const createNewItem = async (data: any) => {
  const params: DynamoPutItemParams = {
    TableName: TABLE_NAME,
    Item: {
      id: uuidv4(),
      ...data,
    },
  };
  console.log('item for creation: ', JSON.stringify(params));
  await dynamo.put(params).promise();

  return params.Item;
};

export const deleteItem = async (id: string) => {
  const params: DynamoDeleteItemParams = {
    TableName: TABLE_NAME,
    Key: {
      id,
    },
  };

  await dynamo.delete(params).promise();
};

// todo: find a way to update all items in one transaction instead of multiple DB calls
export const updateItem = async (id: string, data: any) => {
  const promises = await Promise.all(
    Object.keys(data).map((key) => {
      const params: DynamoUpdateItemParams = {
        TableName: TABLE_NAME,
        Key: {
          id,
        },
        UpdateExpression: `set ${key} = :updateValue`,
        ExpressionAttributeValues: {
          ':updateValue': data[key],
        },
        ReturnValues: 'ALL_NEW', // get all the item attributes after they are updated
      };

      return dynamo.update(params).promise();
    })
  );

  return promises[promises.length - 1].Attributes;
};
