import { run } from '../runner';
import { expect } from 'chai';
import 'mocha';

const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg : any) => {
      importObject.output += arg;
      importObject.output += "\n";
      return arg;
    },
    abs: (arg : any) => {
      return Math.abs(arg);
    },
    min: Math.min,
    max: Math.max,
    pow: Math.pow
  },

  output: ""
};

// Clear the output before every test
beforeEach(function () {
  importObject.output = "";
});
  
// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected. 
describe('run(source, config) function', () => {
  const config = { importObject };
  
  // We can test the behavior of the compiler in several ways:
  // 1- we can test the return value of a program
  // Note: since run is an async function, we use await to retrieve the 
  // asynchronous return value. 
  it('returns the right number', async () => {
    const result = await run("987", config);
    expect(result).to.equal(987);
  });

  // 2- we can test the behavior of the compiler by also looking at the log 
  // resulting from running the program
  it('prints something right', async() => {
    var result = await run("print(1337)", config);
    expect(config.importObject.output).to.equal("1337\n");
  });

  // 3- we can also combine both type of assertions, or feel free to use any 
  // other assertions provided by chai.
  it('prints two numbers but returns last one', async () => {
    var result = await run("print(987)", config);
    expect(result).to.equal(987);
    result = await run("print(123)", config);
    expect(result).to.equal(123);
    
    expect(config.importObject.output).to.equal("987\n123\n");
  });

  // Note: it is often helpful to write tests for a functionality before you
  // implement it. You will make this test pass!
  it('adds two numbers', async() => {
    const result = await run("2 + 3", config);
    console.log(result)
    expect(result).to.equal(5);
  });

  // 5- we are checking for basic abs  
  // resulting from running the program
  it('finds absolute of a negative number', async() => {
    var result = await run("abs(-1)", config);
    expect(result).to.equal(1);
  });

  // 6- we are checking for more abs cases  
  // resulting from running the program
  it('prints absolute of value returned by min funtion', async() => {
    var result = await run("abs(min(1,-2))", config);
    expect(result).to.equal(2);
  });

  // 7- we are checking for more abs cases  
  // resulting from running the program
  it('prints absolute of value returned by pow funtion', async() => {
    var result = await run("abs(pow(-2,3))", config);
    expect(result).to.equal(8);
  });

  //8 - testing pow
  it('prints pow funtion', async() => {
    var result = await run("pow1 = 1 \n pow2 = 3\n pow(pow2,pow1)\n", config);
    expect(result).to.equal(3);
  });

  //9 - testing print and max
  it('prints and max combination', async() => {
    var result = await run("x = 2 \n y = 4 \n print(max(x,y))", config);
    expect(result).to.equal(4);
    //expect(config.importObject.output).to.equal("4");
  });

  //10 - combination testing - 1
  it('combination tests - 1', async() => {
    var result = await run("max(min(2,3),abs(-5))", config);
    expect(result).to.equal(5);
    //expect(config.importObject.output).to.equal("4");
  });

  //11 - combination testing - 2
  it('combination tests - 2', async() => {
    var result = await run("print(max(min(2,3),abs(-5)))", config);
    expect(result).to.equal(5);
    //expect(config.importObject.output).to.equal("4");
  });

  //12 - combination testing - 3
  it('combination tests - 3', async() => {
    var result = await run("pow(2,print(max(min(2,3),abs(-5))))", config);
    expect(result).to.equal(32);
    //expect(config.importObject.output).to.equal("4");
  });  
  // TODO: add additional tests here to ensure the compiler runs as expected
});

