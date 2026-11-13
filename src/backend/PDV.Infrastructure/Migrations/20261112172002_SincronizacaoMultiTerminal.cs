using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PDV.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SincronizacaoMultiTerminal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NumeroSequencial",
                table: "Vendas",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "TerminalId",
                table: "Vendas",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "CX01");

            migrationBuilder.CreateTable(
                name: "FilaSincronizacao",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TerminalId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    TipoEntidade = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    EntidadeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Operacao = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    PayloadJson = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    Tentativas = table.Column<int>(type: "INTEGER", nullable: false),
                    UltimaTentativaEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    MensagemErro = table.Column<string>(type: "TEXT", nullable: true),
                    SincronizadoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FilaSincronizacao", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Vendas_TerminalId_NumeroSequencial",
                table: "Vendas",
                columns: new[] { "TerminalId", "NumeroSequencial" });

            migrationBuilder.CreateIndex(
                name: "IX_FilaSincronizacao_CriadoEm",
                table: "FilaSincronizacao",
                column: "CriadoEm");

            migrationBuilder.CreateIndex(
                name: "IX_FilaSincronizacao_Status",
                table: "FilaSincronizacao",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FilaSincronizacao");

            migrationBuilder.DropIndex(
                name: "IX_Vendas_TerminalId_NumeroSequencial",
                table: "Vendas");

            migrationBuilder.DropColumn(
                name: "NumeroSequencial",
                table: "Vendas");

            migrationBuilder.DropColumn(
                name: "TerminalId",
                table: "Vendas");
        }
    }
}
