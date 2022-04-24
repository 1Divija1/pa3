import { parse } from './parser';
import { stringifyTree } from './treeprinter';
import {compile} from './compiler';


var ast = parse(" a : int = 10 \n def f(b : int) -> int: \n if b < 25: \n return b * 2  \n else: \n return b \n f(a) \n");
//var ast = parse("x : int = 50 \n if x < 5: \n x = 5 \n elif x > 5: \n x = 5 \n else: \n x = 10 \n print(x)");
compile("i  : int = 0 \n while i < 10: \n i = i + 1 \n print(i)");
console.log(JSON.stringify(ast, null, 2))


