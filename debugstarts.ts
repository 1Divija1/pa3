import { parse } from './parser';
import { stringifyTree } from './treeprinter';
import {compile} from './compiler';

//var ast = parse(" a : int = 10 \n class hello(object): \n b : int = 0 \n   def new(self, n : int, d : int) -> Rat:\n");
//var ast = parse("x : int = 50 \n if x < 5: \n x = 5 \n elif x > 5: \n x = 5 \n else: \n x = 10 \n print(x)");
//var ast = parse(" r1.n = 10 \n r1 = 5 \n");
var ast = parse(" r1.n = r2.mul()\n");


//compile("i  : int = 0 \n while i < 10: \n i = i + 1 \n print(i)");
console.log(JSON.stringify(ast, null, 2))


