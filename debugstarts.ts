import { parse } from './parser';
import { stringifyTree } from './treeprinter';
import {compile} from './compiler';

//var ast = parse(" a : int = 10 \n class hello(object): \n b : int = 0 \n   def new(self, n : int, d : int) -> Rat:\n");
//var ast = parse("x : int = 50 \n if x < 5: \n x = 5 \n elif x > 5: \n x = 5 \n else: \n x = 10 \n print(x)");
//var ast = parse(" r1.n = 10 \n r1 = 5 \n");
var ast = parse(" x : int = 0");


compile("x : int = None");
console.log(JSON.stringify(ast, null, 2))


//var ast = parse(" class C(object):\n  x : int = 123\n  def getX(self: C) -> int:\n    return self.x\n  def setX(self: C, x: int):\n    self.x = x\n\nc : C = None\nc = C()\nprint(c.getX())\nc.setX(42)\nprint(c.getX())\n");
