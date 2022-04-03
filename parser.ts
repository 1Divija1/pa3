import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {BinaryOp, Expr, Stmt} from "./ast";
import { stringifyTree } from "./treeprinter";

export function traverseArgs(c : TreeCursor, s : string) : Array<Expr> {
  var args : Array<Expr> = [];
  c.firstChild(); // go into arglist
  while(c.nextSibling()) {
    args.push(traverseExpr(c, s));
    c.nextSibling();
  } 
  c.parent(); // pop arglist
  return args;
}

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }

    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }

    case "CallExpression":
      c.firstChild();
      const callName = s.substring(c.from, c.to);
      c.nextSibling();
      var args = traverseArgs(c , s);
      if(args.length == 1){
        if( callName!== "abs" && callName!== "print")
          throw new Error("PARSE ERROR : unknown builtin1");
        c.parent(); // pop CallExpression
        return {
          tag: "builtin1",
          name: callName,
          arg: args[0]
        };
  

      } else if(args.length == 2) {
        //buildin2 logic
        if( callName!== "max" && callName!== "min" && callName!=="pow")
          throw new Error("PARSE ERROR : unknown builtin2");
        c.parent(); // pop CallExpression
        return {
          tag: "builtin2",
          name: callName,
          arg1: args[0],
          arg2 : args[1]
        };

      }
    
      throw new Error("PARSE ERROR: There are more than 2 arguments")

      case "UnaryExpression":
        c.firstChild(); // go to unary expression
        var uniOp = (s.substring(c.from, c.to))
        if(uniOp !== "-" && uniOp!== "+"){
          throw new Error("PARSE ERROR : unsupported unary ")
        }
        c.nextSibling();
        var num = Number(uniOp + s.substring(c.from, c.to))
        if(isNaN(num))
          throw new Error("PARSE ERROR: Unary operation failed !!")
        c.parent(); // pop unaryexpression
        return {tag: "num", value: num};

      case "BinaryExpression":
        c.firstChild();
        const left = traverseExpr(c, s);
        c.nextSibling();
        var op : BinaryOp;
        switch(s.substring(c.from, c.to)) {
          case "+":
            op = BinaryOp.Plus;
            break;
          case "-":
            op = BinaryOp.Minus;
            break;
          case "*":
            op = BinaryOp.Mul;
            break;
          default:
            throw new Error("PARSE ERROR : Incorrect Operator")
        }
        c.nextSibling();
        const right = traverseExpr(c, s);
        c.parent(); //pop Binarty Expression
        return {tag: "binaryexp", op, left, right};

    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      console.log("traversed " + stmts.length + " statements ", stmts, "stopped at " , c.node);
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const input = " x = 10 \n print(10)";

  const tree = parser.parse(source);
  console.log(stringifyTree(tree.cursor(), source, 0));

  const cursor = tree.cursor();

  cursor.firstChild();
  cursor.nextSibling();

  console.log(cursor.type.name);
  console.log(input.substring(cursor.from, cursor.to));

  return traverse(tree.cursor(), source);
}
