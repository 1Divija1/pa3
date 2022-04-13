import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {BinaryOp, Expr, Stmt, VarInit, Type, TypedVar, Literal, UnaryOp} from "./ast";
import { stringifyTree } from "./treeprinter";

function isVarDecl(c: TreeCursor, s: string) : Boolean {

  if(c.type.name !== "AssignStatement")
    return false;
  c.firstChild();
  c.nextSibling();
  if(c.type.name !== "TypeDef")
    return false;
  c.parent();
  return true;
}

function isFunDef(c: TreeCursor, s: string) : Boolean { 
  if(c.type.name !== "FunctionDefination")
    return false;
  return true;
}

function traverseVarInit(c : TreeCursor, s : string) : VarInit<null> {
  c.firstChild // go to name
  const typedVar = traverseTypedVar(c , s);
  c.nextSibling(); // =
  c.nextSibling(); //literal
  const literal = traverseLiteral(c,s);
  c.parent()
  return { name: typedVar.name, type : typedVar , init : literal}

}

export function traverseLiteral(c: TreeCursor, s: string): Literal<null> {
  switch (s.substring(c.from, c.to)) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }
    case "Boolean":
      return {
        tag: "bool",
        value: Boolean(s.substring(c.from, c.to))
        }
    case "None":
      return {
        tag: "none"
      }
    default:
      throw new Error("TYPE ERROR : Literal not present");
  }
}

function traverseTypedVar(c : TreeCursor, s : string) : TypedVar<null> {
  const varDec = s.substring(c.from, c.to);
  c.nextSibling();  // a - TypeDef
  c.firstChild(); // :
  c.nextSibling(); //int / bool
  const type = traverseType(c,s)
  c.parent(); // pop TypeDef
  return { name : varDec , type : type}

}

export function traverseType(c: TreeCursor, s: string): Type {
  switch (s.substring(c.from, c.to)) {
    case "int":
      return Type.int;
    case "bool":
      return Type.bool;
    case "None":
      return Type.none
    default:
      throw new Error("TYPE ERROR : Incorrect Type");
  }
}




export function traverseArgs(c : TreeCursor, s : string) : Array<Expr<null>> {
  var args : Array<Expr<null>> = [];
  c.firstChild(); // go into arglist
  while(c.nextSibling()) {
    args.push(traverseExpr(c, s));
    c.nextSibling();
  } 
  c.parent(); // pop arglist
  return args;
}

export function traverseExpr(c : TreeCursor, s : string) : Expr<null> {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "literal",
        literal : traverseLiteral(c, s)
      }
    case "Boolean":
      return {
        tag: "literal",
        literal : traverseLiteral(c, s)
      }
    case "None":
      return {
        tag: "literal",
        literal : traverseLiteral(c, s)
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
      c.parent();
      return {
        tag : "call",
        name : callName,
        args : args
      }
    
      case "UnaryExpression":
        c.firstChild();
        const argUnary = traverseExpr(c, s);
        c.nextSibling();
        var op1 : UnaryOp;
        switch(s.substring(c.from, c.to)) {
          case "-":
            op1 = UnaryOp.Minus
            break;
          case "not":
            op1 = UnaryOp.Not;
            break;
          default:
            throw new Error("PARSE ERROR : Incorrect Operator")
        }
        c.parent(); //pop Binarty Expression
        return {tag: "unaryexp", op : op1, left : argUnary};

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
          case "//":
            op = BinaryOp.Div;
            break;
          case "<":
            op = BinaryOp.Less;
            break;
          case "<=":
              op = BinaryOp.LessEqual;
              break;
          case ">":
            op = BinaryOp.Greater;
            break;
          case ">=":
            op = BinaryOp.GreaterEqual;
            break;
          case "==":
              op = BinaryOp.Equal;
              break;
          case "!=":
            op = BinaryOp.NotEqual;
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

export function traverseStmt(c : TreeCursor, s : string) : Stmt<null> {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "assign",
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

export function traverse(c : TreeCursor, s : string) : Array<Stmt<null>> {
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
export function parse(source : string) : Array<Stmt<null>> {

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
