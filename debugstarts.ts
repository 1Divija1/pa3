import { parse } from './parser';
import { stringifyTree } from './treeprinter';
import {compile} from './compiler';


var ast = parse("x:bool = False");
compile("b : bool = False \n print(b)");
console.log(JSON.stringify(ast, null, 2))






