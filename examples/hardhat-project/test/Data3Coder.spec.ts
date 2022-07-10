import { ethers } from 'hardhat';
import { expect } from "chai";

describe('Data3Coder.sol', () => {
	let externalData3: any;

	before(async () => {
		const Factory = await ethers.getContractFactory('ExternalData3Coder');
		externalData3 = await Factory.deploy();
	})

	describe('decode', () => {
		it('Should be able to get min/max values', async () => {
			await externalData3.encode("0x07", "0x00", "0x7fff", "-0x80000000", true, false);
			const { myEnum, a, b, c, d, x } = await externalData3.decode()
			expect(myEnum).to.eq("0x07");
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
			expect(d).to.eq(true);
			expect(x).to.eq(false);
		});

		it('Should be able to get max/min values', async () => {
			await externalData3.encode("0x00", "0xffff", "-0x8000", "0x7fffffff", false, true);
			const { myEnum, a, b, c, d, x } = await externalData3.decode()
			expect(myEnum).to.eq("0x00");
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
			expect(d).to.eq(false);
			expect(x).to.eq(true);
		});
	})

	describe('encode', () => {
		it('Reverts when myEnum overflows', async () => {
			await expect(
			externalData3.encode("0x0f", "0x00", "-0x8000", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when a overflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x01ffff", "-0x8000", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "0x7fffff", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "-0x800000", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "-0x8000", "0x7fffffffff", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "-0x8000", "-0x8000000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData3.encode("0x07", "0x00", "0x7fff", "-0x80000000", true, false)
			const { myEnum, a, b, c, d, x } = await externalData3.decode();
			expect(myEnum).to.eq("0x07");
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
			expect(d).to.eq(true);
			expect(x).to.eq(false);
		});

		it('Should be able to set max/min values', async () => {
			externalData3.encode("0x00", "0xffff", "-0x8000", "0x7fffffff", false, true)
			const { myEnum, a, b, c, d, x } = await externalData3.decode();
			expect(myEnum).to.eq("0x00");
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
			expect(d).to.eq(false);
			expect(x).to.eq(true);
		});
	})

	describe('setAbc', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData3.setAbc("0x01ffff", "-0x8000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "0x7fffff", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "-0x800000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "-0x8000", "0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "-0x8000", "-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData3.setAbc("0xffff", "-0x8000", "0x7fffffff")
			const { a, b, c } = await externalData3.decode();
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData3.setAbc("0x00", "0x7fff", "-0x80000000")
			const { a, b, c } = await externalData3.decode();
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('setCba', () => {
		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.setCba(false, "0x7fffff", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.setCba(false, "-0x800000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.setCba(false, "-0x8000", "0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.setCba(false, "-0x8000", "-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData3.setCba(true, "-0x8000", "0x7fffffff")
			const { x, b, c } = await externalData3.decode();
			expect(x).to.eq(true);
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData3.setCba(false, "0x7fff", "-0x80000000")
			const { x, b, c } = await externalData3.decode();
			expect(x).to.eq(false);
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('getMyEnum', () => {
		it('Should be able to get min value', async () => {
			await externalData3.encode("0x07", "0x00", "-0x8000", "-0x80000000", false, false);
			const myEnum = await externalData3.getMyEnum()
			expect(myEnum).to.eq("0x07");
		});

		it('Should be able to get max value', async () => {
			await externalData3.encode("0x00", "0xffff", "0x7fff", "0x7fffffff", true, true);
			const myEnum = await externalData3.getMyEnum()
			expect(myEnum).to.eq("0x00");
		});
	})

	describe('setMyEnum', () => {
		it('Reverts when myEnum overflows', async () => {
			await expect(
			externalData3.setMyEnum("0x0f")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setMyEnum("0x07")
			const { myEnum } = await externalData3.decode();
			expect(myEnum).to.eq("0x07");
		});

		it('Should be able to set max value', async () => {
			externalData3.setMyEnum("0x00")
			const { myEnum } = await externalData3.decode();
			expect(myEnum).to.eq("0x00");
		});
	})

	describe('getA', () => {
		it('Should be able to get min value', async () => {
			await externalData3.encode("0x00", "0xffff", "-0x8000", "-0x80000000", false, false);
			const a = await externalData3.getA()
			expect(a).to.eq("0xffff");
		});

		it('Should be able to get max value', async () => {
			await externalData3.encode("0x07", "0x00", "0x7fff", "0x7fffffff", true, true);
			const a = await externalData3.getA()
			expect(a).to.eq("0x00");
		});
	})

	describe('setA', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData3.setA("0x01ffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setA("0xffff")
			const { a } = await externalData3.decode();
			expect(a).to.eq("0xffff");
		});

		it('Should be able to set max value', async () => {
			externalData3.setA("0x00")
			const { a } = await externalData3.decode();
			expect(a).to.eq("0x00");
		});
	})

	describe('getB', () => {
		it('Should be able to get min value', async () => {
			await externalData3.encode("0x00", "0x00", "0x7fff", "-0x80000000", false, false);
			const b = await externalData3.getB()
			expect(b).to.eq("0x7fff");
		});

		it('Should be able to get max value', async () => {
			await externalData3.encode("0x07", "0xffff", "-0x8000", "0x7fffffff", true, true);
			const b = await externalData3.getB()
			expect(b).to.eq("-0x8000");
		});
	})

	describe('setB', () => {
		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.setB("0x7fffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.setB("-0x800000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setB("0x7fff")
			const { b } = await externalData3.decode();
			expect(b).to.eq("0x7fff");
		});

		it('Should be able to set max value', async () => {
			externalData3.setB("-0x8000")
			const { b } = await externalData3.decode();
			expect(b).to.eq("-0x8000");
		});
	})

	describe('getC', () => {
		it('Should be able to get min value', async () => {
			await externalData3.encode("0x00", "0x00", "-0x8000", "0x7fffffff", false, false);
			const c = await externalData3.getC()
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to get max value', async () => {
			await externalData3.encode("0x07", "0xffff", "0x7fff", "-0x80000000", true, true);
			const c = await externalData3.getC()
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('setC', () => {
		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.setC("0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.setC("-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setC("0x7fffffff")
			const { c } = await externalData3.decode();
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max value', async () => {
			externalData3.setC("-0x80000000")
			const { c } = await externalData3.decode();
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('getD', () => {
		it('Should be able to get min value', async () => {
			await externalData3.encode("0x00", "0x00", "-0x8000", "-0x80000000", true, false);
			const d = await externalData3.getD()
			expect(d).to.eq(true);
		});

		it('Should be able to get max value', async () => {
			await externalData3.encode("0x07", "0xffff", "0x7fff", "0x7fffffff", false, true);
			const d = await externalData3.getD()
			expect(d).to.eq(false);
		});
	})

	describe('setD', () => {
		it('Should be able to set min value', async () => {
			externalData3.setD(true)
			const { d } = await externalData3.decode();
			expect(d).to.eq(true);
		});

		it('Should be able to set max value', async () => {
			externalData3.setD(false)
			const { d } = await externalData3.decode();
			expect(d).to.eq(false);
		});
	})

	describe('getX', () => {
		it('Should be able to get min value', async () => {
			await externalData3.encode("0x00", "0x00", "-0x8000", "-0x80000000", false, true);
			const x = await externalData3.getX()
			expect(x).to.eq(true);
		});

		it('Should be able to get max value', async () => {
			await externalData3.encode("0x07", "0xffff", "0x7fff", "0x7fffffff", true, false);
			const x = await externalData3.getX()
			expect(x).to.eq(false);
		});
	})

	describe('setX', () => {
		it('Should be able to set min value', async () => {
			externalData3.setX(true)
			const { x } = await externalData3.decode();
			expect(x).to.eq(true);
		});

		it('Should be able to set max value', async () => {
			externalData3.setX(false)
			const { x } = await externalData3.decode();
			expect(x).to.eq(false);
		});
	})
})