// Prints the inputs of every order-placing function in the perp pool ABIs the SDK ships,
// to show there is no reduce-only input on a regular (non-stop) perp order.
import * as sdk from "@somnia-chain/markets-sdk"

const abis = Object.entries(sdk).filter(([k, v]) => /perpPool.*Abi$|operatorAbi$/i.test(k) && Array.isArray(v)) as [string, any[]][]
for (const [name, abi] of abis) {
  for (const f of abi.filter((x) => x.type === "function" && /^(placeOrder|placeOrderFor|placeOrders|placeOrdersFor|amendOrder|amendOrders)$/.test(x.name))) {
    const flat = (inputs: any[]): string[] => inputs.flatMap((i) => (i.components ? [`${i.name}{${flat(i.components).join(", ")}}`] : [`${i.type} ${i.name}`]))
    console.log(`${name}.${f.name}(${flat(f.inputs).join(", ")})`)
  }
}
console.log("ORDER_TYPE", JSON.stringify(sdk.ORDER_TYPE))
const mentions = abis.flatMap(([n, abi]) => abi.filter((x) => JSON.stringify(x).toLowerCase().includes("reduceonly") && x.type === "function").map((x) => `${n}.${x.name}`))
console.log("functions mentioning reduceOnly in these ABIs:", mentions.length ? mentions.join(", ") : "none")
