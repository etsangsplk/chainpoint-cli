/* Copyright 2017 Tierion
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

const utils = require('./utils.js')
const storage = require('./storage.js')
const cpb = require('chainpoint-binary')
const updateCmd = require('./update.js')
const OutputBuilder = require('./output-builder.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('export')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server[0]

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    output.addErrorResult({
      hash_id_node: hashIdNode,
      message: `missing or invalid hash_id_node`
    })
    output.display(quiet, json)
    return
  }
  // parameters are valid, open storage and process export
  try {
    let hashDb = await storage.connectAsync()
    let proofHandles = [{ uri: baseURI, hashIdNode: hashIdNode }]
    await updateCmd.updateHashesByHashIdNodeAsync(hashDb, proofHandles)
    // retrieve the proof by hash_id_node
    let hashItem = await hashDb.findOneAsync({ _id: hashIdNode })
    if (!hashItem || !hashItem.proof) throw new Error('proof data not found')

    // save file
    let exportAsJSON = !argv.binary
    let filename = `${hashItem._id}.chp${exportAsJSON ? '.json' : ''}`
    let path = `./${filename}`
    let proofObj = null
    try {
      proofObj = cpb.binaryToObjectSync(hashItem.proof)
    } catch (err) {
      throw new Error('bad proof data')
    }
    let writeSuccess = false
    if (exportAsJSON) { // save the proof as a JSON string with extension .chp.json
      let proofJSON = JSON.stringify(proofObj, null, 2)
      writeSuccess = utils.writeFile(path, proofJSON)
    } else { // save the proof as binary data with extension .chp
      let proofBin = cpb.objectToBinarySync(proofObj)
      writeSuccess = utils.writeFile(path, proofBin)
    }
    if (!writeSuccess) throw new Error('cannot write file')

    output.addSuccessResult({
      hash_id_node: hashIdNode,
      filename: filename,
      message: `exported`
    })
    output.display(quiet, json)
  } catch (error) {
    output.addErrorResult({
      hash_id_node: hashIdNode,
      message: `${error.message}`
    })
    output.display(quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
